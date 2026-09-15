import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

// 内置默认健康知识（当数据库为空时兜底，保证前端可联调）
const DEFAULT_KNOWLEDGE = [
  {
    id: 'kb-default-1',
    category: 'chronic_disease',
    title: '高血压患者的日常管理要点',
    summary: '规律服药、限盐饮食、定期监测血压是控制高血压的三大基石。',
    content: '1. 遵医嘱按时服用降压药，切勿自行停药。\n2. 每日食盐摄入控制在5克以内。\n3. 建议每日固定时间测量血压并记录。\n4. 每周中等强度运动150分钟。\n5. 戒烟限酒，保持健康体重。',
    tags: JSON.stringify(['高血压', '日常管理', '用药']),
    readCount: 0,
    sortOrder: 1,
  },
  {
    id: 'kb-default-2',
    category: 'medication_safety',
    title: '家庭用药安全常识',
    summary: '药品分类存放、看清有效期、注意相互作用，避免用药错误。',
    content: '1. 药品应存放在阴凉干燥处，避光。\n2. 定期清理过期药品。\n3. 多种药物同服前请咨询医生或药师。\n4. 儿童药品应放在儿童不易触及处。\n5. 保留药品说明书。',
    tags: JSON.stringify(['用药安全', '家庭药箱']),
    readCount: 0,
    sortOrder: 2,
  },
  {
    id: 'kb-default-3',
    category: 'nutrition',
    title: '均衡膳食的"膳食宝塔"',
    summary: '谷薯类为主，蔬果丰富，适量鱼禽蛋肉，少油少盐。',
    content: '1. 主食粗细搭配。\n2. 每天蔬菜300-500克，水果200-350克。\n3. 优质蛋白优先鱼禽蛋瘦肉。\n4. 奶类及豆制品每天摄入。\n5. 烹调少油少盐少糖。',
    tags: JSON.stringify(['营养', '膳食', '健康饮食']),
    readCount: 0,
    sortOrder: 3,
  },
  {
    id: 'kb-default-4',
    category: 'child_care',
    title: '婴幼儿疫苗接种时间表',
    summary: '按时完成免疫规划疫苗接种，是保护儿童健康的重要措施。',
    content: '1. 出生时：卡介苗、乙肝疫苗第1针。\n2. 1月龄：乙肝疫苗第2针。\n3. 2月龄：脊灰疫苗第1剂。\n4. 3月龄：脊灰第2剂、百白破第1剂。\n5. 6月龄：乙肝疫苗第3针、A群流脑第1剂。\n具体以当地接种门诊安排为准。',
    tags: JSON.stringify(['儿童', '疫苗', '接种']),
    readCount: 0,
    sortOrder: 4,
  },
  {
    id: 'kb-default-5',
    category: 'elderly_care',
    title: '老年人防跌倒居家改造',
    summary: '居家防跌倒能显著降低老年人意外伤害风险。',
    content: '1. 浴室铺设防滑垫，安装扶手。\n2. 保证夜间照明，床边放置小夜灯。\n3. 清除地面杂物与门槛高差。\n4. 常用物品放在易取处，避免攀爬。\n5. 穿防滑鞋。',
    tags: JSON.stringify(['适老化', '防跌倒', '居家安全']),
    readCount: 0,
    sortOrder: 5,
  },
  {
    id: 'kb-default-6',
    category: 'first_aid',
    title: '突发胸痛如何紧急应对',
    summary: '胸痛可能是心梗信号，务必立即就医，把握黄金抢救时间。',
    content: '1. 立即停止活动，原地休息。\n2. 拨打120急救电话。\n3. 如医生建议可舌下含服硝酸甘油（如有）。\n4. 保持镇静，解开过紧衣物。\n5. 出现意识丧失立即心肺复苏并呼叫急救。',
    tags: JSON.stringify(['急救', '胸痛', '心梗']),
    readCount: 0,
    sortOrder: 6,
  },
];

const DEFAULT_CATEGORIES = [
  { category: 'chronic_disease', label: '慢病管理' },
  { category: 'medication_safety', label: '用药安全' },
  { category: 'nutrition', label: '营养膳食' },
  { category: 'child_care', label: '母婴育儿' },
  { category: 'elderly_care', label: '适老关怀' },
  { category: 'first_aid', label: '急救常识' },
];

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 列表
  // ============================================================

  async list(opts: { category?: string; keyword?: string; page?: number; pageSize?: number } = {}) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;

    const where: any = { isPublished: true };
    if (opts.category) where.category = opts.category;
    if (opts.keyword) {
      where.OR = [
        { title: { contains: opts.keyword } },
        { summary: { contains: opts.keyword } },
      ];
    }

    const total = await this.prisma.knowledge.count({ where });
    if (total === 0) {
      // 数据库为空 → 返回内置默认知识（不计入数据库）
      let items = DEFAULT_KNOWLEDGE;
      if (opts.category) items = items.filter((k) => k.category === opts.category);
      if (opts.keyword) {
        const kw = opts.keyword.toLowerCase();
        items = items.filter(
          (k) => k.title.toLowerCase().includes(kw) || k.summary.toLowerCase().includes(kw),
        );
      }
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        pagination: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) },
        source: 'default',
      };
    }

    const items = await this.prisma.knowledge.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, category: true, title: true, summary: true,
        tags: true, coverUrl: true, readCount: true, createdAt: true,
      },
    });

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      source: 'db',
    };
  }

  // ============================================================
  // 分类
  // ============================================================

  async categories() {
    const rows = await this.prisma.knowledge.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { _all: true },
    });
    if (rows.length === 0) {
      return DEFAULT_CATEGORIES.map((c) => ({ ...c, count: 1 }));
    }
    const countMap = new Map(rows.map((r) => [r.category, r._count._all]));
    // 始终返回全部默认分类，但其 count 反映数据库中真实文章数（无文章则为 0）
    return DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      count: countMap.get(c.category) ?? 0,
    }));
  }

  // ============================================================
  // 详情
  // ============================================================

  async getById(id: string) {
    const article = await this.prisma.knowledge.findUnique({ where: { id } });
    if (article) {
      await this.prisma.knowledge.update({
        where: { id },
        data: { readCount: { increment: 1 } },
      });
      return article;
    }

    // 兜底：默认知识
    const def = DEFAULT_KNOWLEDGE.find((k) => k.id === id);
    if (def) return def;

    throw new NotFoundException('知识文章不存在');
  }
}
