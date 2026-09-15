import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 列表
  // ============================================================

  async list(memberId: string, userId: string, page = 1, pageSize = 20) {
    await this.verifyMemberAccess(memberId, userId);

    const [items, total] = await Promise.all([
      this.prisma.healthReport.findMany({
        where: { memberId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, type: true, title: true, periodStart: true, periodEnd: true,
          summary: true, pdfUrl: true, createdAt: true,
        },
      }),
      this.prisma.healthReport.count({ where: { memberId } }),
    ]);

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ============================================================
  // 生成报告
  // ============================================================

  async generate(dto: GenerateReportDto, userId: string) {
    const member = await this.verifyMemberAccess(dto.memberId, userId);
    const familyId = member.familyId;

    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : new Date();
    const periodStart = dto.periodStart
      ? new Date(dto.periodStart)
      : new Date(periodEnd.getTime() - 30 * 86400000);

    // 1. 健康档案
    const healthRecord = await this.prisma.healthRecord.findUnique({
      where: { memberId: dto.memberId },
    });

    // 2. 近期自评
    const assessments = await this.prisma.assessment.findMany({
      where: { memberId: dto.memberId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true, type: true, totalScore: true,
        categoryScores: true, topConcerns: true, completedAt: true,
      },
    });

    // 3. 近期指标 (30天)
    const metrics = await this.prisma.healthMetric.findMany({
      where: { memberId: dto.memberId, recordedAt: { gte: periodStart } },
      orderBy: { recordedAt: 'asc' },
    });
    const metricsSummary = this.summarizeMetrics(metrics);

    // 4. 在用药物
    const medications = await this.prisma.medicationPlan.findMany({
      where: { memberId: dto.memberId, isActive: true },
      select: { id: true, medicineName: true, dosage: true, dosageUnit: true, frequency: true },
    });

    // 5. 组装结构化数据
    const dataJson = {
      member: {
        nickname: member.nickname,
        age: member.age,
        gender: member.gender,
        relation: member.relation,
      },
      healthRecord: healthRecord
        ? {
            bloodType: healthRecord.bloodType,
            heightCm: healthRecord.heightCm,
            weightKg: healthRecord.weightKg,
            chronicDiseases: this.safeParse(healthRecord.chronicDiseases),
            allergies: this.safeParse(healthRecord.allergies),
            surgeries: this.safeParse(healthRecord.surgeries),
            familyHistory: this.safeParse(healthRecord.familyHistory),
            vaccinations: this.safeParse(healthRecord.vaccinations),
          }
        : null,
      assessments,
      metricsSummary,
      medications,
      period: { start: periodStart, end: periodEnd },
    };

    const summary = this.buildSummary(member.nickname, healthRecord, assessments, metricsSummary, medications);

    const title = dto.title
      ?? `${member.nickname}的健康报告 (${periodStart.toISOString().slice(0, 10)} ~ ${periodEnd.toISOString().slice(0, 10)})`;

    const report = await this.prisma.healthReport.create({
      data: {
        memberId: dto.memberId,
        familyId,
        type: dto.type ?? 'periodic',
        title,
        periodStart,
        periodEnd,
        summary,
        dataJson: JSON.stringify(dataJson),
        createdBy: userId,
      },
    });

    // 生成 PDF（Plan 2: pdfkit）并回写 pdfUrl；失败降级为 JSON 数据文件（Plan 1）
    let pdfUrl: string | null = null;
    try {
      pdfUrl = await this.generatePdf(report.id, dataJson, summary, member, assessments, metricsSummary, medications);
    } catch (pdfErr) {
      this.logger.error(`PDF 生成失败，降级为 JSON 数据文件: ${(pdfErr as Error).message}`);
      // TODO: 生产环境建议接入专业 PDF 渲染服务；当前降级保证可导出结构化数据
      try {
        pdfUrl = await this.generateJsonFallback(report.id, dataJson, summary);
      } catch (jsonErr) {
        this.logger.error(`JSON 降级导出也失败: ${(jsonErr as Error).message}`);
      }
    }
    if (pdfUrl) {
      await this.prisma.healthReport.update({ where: { id: report.id }, data: { pdfUrl } });
    }

    return { ...report, pdfUrl };
  }

  // ============================================================
  // 详情
  // ============================================================

  async getById(id: string, userId: string) {
    const report = await this.prisma.healthReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('报告不存在');
    await this.verifyMemberAccess(report.memberId, userId);
    return report;
  }

  // ============================================================
  // 辅助
  // ============================================================

  private summarizeMetrics(metrics: any[]) {
    const byType = new Map<string, number[]>();
    const units = new Map<string, string>();
    for (const m of metrics) {
      if (!byType.has(m.metricType)) byType.set(m.metricType, []);
      byType.get(m.metricType)!.push(m.value);
      units.set(m.metricType, m.unit);
    }
    const result: any[] = [];
    for (const [type, values] of byType.entries()) {
      result.push({
        metricType: type,
        unit: units.get(type),
        latest: values[values.length - 1],
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        min: values.reduce((min, value) => (value < min ? value : min), values[0]),
        max: values.reduce((max, value) => (value > max ? value : max), values[0]),
        count: values.length,
      });
    }
    return result;
  }

  private buildSummary(
    nickname: string,
    healthRecord: any,
    assessments: any[],
    metricsSummary: any[],
    medications: any[],
  ): string {
    const lines: string[] = [];
    lines.push(`【${nickname}健康报告摘要】`);
    if (healthRecord) {
      const chronic = this.safeParse(healthRecord.chronicDiseases);
      const allergies = this.safeParse(healthRecord.allergies);
      lines.push(`· 基础信息: 血型 ${healthRecord.bloodType || '未知'}, 身高 ${healthRecord.heightCm || '-'}cm, 体重 ${healthRecord.weightKg || '-'}kg`);
      lines.push(`· 慢病史: ${chronic.length ? chronic.map((c: any) => (typeof c === 'string' ? c : c.name || c.disease || '未知')).join('、') : '无'}`);
      lines.push(`· 过敏史: ${allergies.length ? allergies.map((a: any) => (typeof a === 'string' ? a : a.name || a.allergen || '未知')).join('、') : '无'}`);
    }
    if (assessments.length) {
      lines.push(`· 最近自评总分: ${assessments[0].totalScore ?? '未评分'} (${assessments[0].completedAt?.toISOString().slice(0, 10) || '-'})`);
    }
    if (metricsSummary.length) {
      lines.push(`· 指标概览: ${metricsSummary.map((m) => `${m.metricType}=${m.latest}${m.unit}`).join(', ')}`);
    }
    if (medications.length) {
      lines.push(`· 在用药物: ${medications.map((m) => `${m.medicineName}${m.dosage ? ' ' + m.dosage + (m.dosageUnit || '') : ''}`).join('、')}`);
    }
    return lines.join('\n');
  }

  private safeParse(str: string | null | undefined): any[] {
    if (!str) return [];
    try {
      const p = JSON.parse(str);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }

  private async verifyMemberAccess(memberId: string, userId: string) {
    const member = await this.prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { id: true, familyId: true, nickname: true, age: true, gender: true, relation: true },
    });
    if (!member) throw new NotFoundException('成员不存在');

    const membership = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: member.familyId, userId } },
    });
    if (!membership) throw new ForbiddenException('无权访问该成员的报告');

    return member;
  }

  // ============================================================
  // PDF 生成（P1-U3）
  // ============================================================

  /**
   * 生成健康报告 PDF（pdfkit），保存到 public/uploads/reports 并返回可访问 URL。
   * 中文渲染依赖 CJK 字体，未配置时回退默认字体（中文可能空白）。
   */
  private generatePdf(
    reportId: string,
    data: any,
    summary: string,
    member: any,
    assessments: any[],
    metricsSummary: any[],
    medications: any[],
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = join(process.cwd(), 'public', 'uploads', 'reports');
      try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
      const filename = `${reportId}.pdf`;
      const fullPath = join(dir, filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = createWriteStream(fullPath);
      doc.pipe(stream);

      // 注册 CJK 字体以保证中文渲染
      const fontApplied = this.applyCjkFont(doc);
      if (!fontApplied) {
        // TODO: 生产环境务必通过 PDF_FONT_PATH 挂载 CJK 字体，否则中文无法渲染
        this.logger.warn('未找到可用的 CJK 字体，PDF 中文可能显示为空白；请配置 PDF_FONT_PATH');
      }

      const line = (s: string) => doc.fontSize(11).text(s);
      const section = (s: string) => {
        doc.moveDown(0.5);
        doc.fontSize(14).text(s, { underline: true });
        doc.moveDown(0.3);
      };

      // 标题
      doc.fontSize(20).text(`${member.nickname} 的健康报告`, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).text(`生成时间：${new Date().toLocaleString('zh-CN')}`, { align: 'center' });
      doc.moveDown(1);

      // 一、基础信息
      section('一、基础信息');
      line(`姓名：${member.nickname}    性别：${member.gender ?? '-'}    年龄：${member.age ?? '-'}    关系：${member.relation ?? '-'}`);
      const hr = data.healthRecord;
      if (hr) {
        line(`血型：${hr.bloodType ?? '未知'}    身高：${hr.heightCm ?? '-'} cm    体重：${hr.weightKg ?? '-'} kg`);
        line(`慢病史：${this.formatList(hr.chronicDiseases)}`);
        line(`过敏史：${this.formatList(hr.allergies)}`);
        line(`手术史：${this.formatList(hr.surgeries)}`);
        line(`家族史：${this.formatList(hr.familyHistory)}`);
        line(`疫苗接种史：${this.formatList(hr.vaccinations)}`);
      }

      // 二、近期健康自评
      section('二、近期健康自评');
      if (assessments && assessments.length) {
        assessments.forEach((a, i) => {
          const cs = a.categoryScores ? this.formatCategoryScores(a.categoryScores) : '';
          line(`第 ${i + 1} 次（${this.fmtDate(a.completedAt)}）总分：${a.totalScore ?? '未评分'}${cs ? '  ' + cs : ''}`);
        });
      } else {
        line('暂无自评记录');
      }

      // 三、近期指标概览
      section('三、近期指标概览');
      if (metricsSummary && metricsSummary.length) {
        metricsSummary.forEach((m) => {
          line(`· ${m.metricType}：最新 ${m.latest}${m.unit}，均值 ${m.avg}，范围 ${m.min}~${m.max}（共 ${m.count} 条）`);
        });
      } else {
        line('暂无指标记录');
      }

      // 四、在用药物
      section('四、在用药物');
      if (medications && medications.length) {
        medications.forEach((m) => {
          line(`· ${m.medicineName}${m.dosage ? ' ' + m.dosage + (m.dosageUnit || '') : ''}  ${m.frequency || ''}`);
        });
      } else {
        line('暂无在用药物');
      }

      // 五、健康摘要
      section('五、健康摘要');
      line(summary || '（无摘要）');

      doc.end();
      stream.on('finish', () => resolve(`/uploads/reports/${filename}`));
      stream.on('error', (err: Error) => reject(err));
    });
  }

  /**
   * 降级方案（Plan 1）：导出结构化 JSON 数据文件，返回可下载 URL。
   */
  private async generateJsonFallback(reportId: string, data: any, summary: string): Promise<string> {
    const dir = join(process.cwd(), 'public', 'uploads', 'reports');
    try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    const filename = `${reportId}.json`;
    const fullPath = join(dir, filename);
    const payload = { summary, data, generatedAt: new Date().toISOString() };
    await writeFile(fullPath, JSON.stringify(payload, null, 2), 'utf8');
    return `/uploads/reports/${filename}`;
  }

  /**
   * 依次尝试候选路径中的 CJK 字体并注册到 PDF 文档。
   * 优先使用环境变量 PDF_FONT_PATH，其次常见系统字体路径。
   */
  private applyCjkFont(doc: InstanceType<typeof PDFDocument>): boolean {
    const candidates = [
      process.env.PDF_FONT_PATH,
      'C:/Windows/Fonts/simhei.ttf',
      'C:/Windows/Fonts/simsun.ttc',
      'C:/Windows/Fonts/msyh.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf',
    ].filter(Boolean) as string[];
    for (const fontPath of candidates) {
      try {
        if (existsSync(fontPath)) {
          doc.font(fontPath);
          return true;
        }
      } catch {
        // 尝试下一个候选字体
      }
    }
    return false;
  }

  private formatList(list: any): string {
    if (!list) return '无';
    const arr = Array.isArray(list)
      ? list
      : this.safeParse(typeof list === 'string' ? list : null);
    if (!arr.length) return '无';
    return arr
      .map((x: any) => (typeof x === 'string' ? x : (x.name || x.disease || x.allergen || x.label || JSON.stringify(x))))
      .join('、');
  }

  private formatCategoryScores(categoryScores: any): string {
    const obj = typeof categoryScores === 'string' ? this.safeParse(categoryScores) : (categoryScores || {});
    const entries = Object.entries(obj as Record<string, any>);
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${k} ${v}`).join('，');
  }

  private fmtDate(d: any): string {
    if (!d) return '-';
    try { return new Date(d).toISOString().slice(0, 10); } catch { return '-'; }
  }
}
