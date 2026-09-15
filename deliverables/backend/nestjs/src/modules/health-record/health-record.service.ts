import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventBusService } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { UpdateHealthRecordDto } from './dto/update-record.dto';
import { UpdateChronicDiseasesDto } from './dto/update-chronic.dto';
import { UpdateAllergiesDto } from './dto/update-allergy.dto';
import { UpdateSurgeriesDto } from './dto/update-surgery.dto';
import { UpdateFamilyHistoryDto } from './dto/update-family-history.dto';
import { UpdateVaccinationsDto } from './dto/update-vaccination.dto';
import { FamilyPolicyService } from '../../common/policies/family-policy.service';

const HEALTH_RECORD_JSON_DEFAULTS = {
  chronicDiseases: '[]',
  allergies: '[]',
  surgeries: '[]',
  familyHistory: '[]',
  vaccinations: '[]',
};

@Injectable()
export class HealthRecordService {
  private readonly logger = new Logger(HealthRecordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBusService,
    private readonly policy: FamilyPolicyService,
  ) {}

  /**
   * 获取成员健康档案（Cache-Aside 模式，TTL 5 分钟）
   */
  async getByMemberId(memberId: string, userId: string) {
    await this.verifyMemberAccess(memberId, userId);

    return this.cache.getOrSet(
      `member:${memberId}:health_record`,
      300, // 5 min TTL
      async () => {
        const record = await this.prisma.healthRecord.findUnique({
          where: { memberId },
        });
        if (!record) {
          // 如果不存在则自动创建（例如通过家庭模块 addMember 时可能还未创建）
          return this.prisma.healthRecord.create({
            data: { memberId, ...HEALTH_RECORD_JSON_DEFAULTS },
          });
        }
        return record;
      },
    );
  }

  /**
   * 更新健康档案基本信息
   */
  async update(memberId: string, userId: string, dto: UpdateHealthRecordDto) {
    await this.verifyMemberAccess(memberId, userId, true);

    // 档案可能尚未创建（直接 PATCH 场景）→ upsert 自动建挡，避免 P2025
    const record = await this.prisma.healthRecord.upsert({
      where: { memberId },
      create: {
        memberId,
        ...HEALTH_RECORD_JSON_DEFAULTS,
        ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
        ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.lastCheckupDate !== undefined && {
          lastCheckupDate: new Date(dto.lastCheckupDate),
        }),
        ...(dto.checkupSummary !== undefined && {
          checkupSummary: dto.checkupSummary,
        }),
        ...(dto.surgeries !== undefined && { surgeries: JSON.stringify(dto.surgeries) }),
        ...(dto.familyHistory !== undefined && { familyHistory: JSON.stringify(dto.familyHistory) }),
        ...(dto.vaccinations !== undefined && { vaccinations: JSON.stringify(dto.vaccinations) }),
      },
      update: {
        ...(dto.bloodType !== undefined && { bloodType: dto.bloodType }),
        ...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.lastCheckupDate !== undefined && {
          lastCheckupDate: new Date(dto.lastCheckupDate),
        }),
        ...(dto.checkupSummary !== undefined && {
          checkupSummary: dto.checkupSummary,
        }),
        ...(dto.surgeries !== undefined && { surgeries: JSON.stringify(dto.surgeries) }),
        ...(dto.familyHistory !== undefined && { familyHistory: JSON.stringify(dto.familyHistory) }),
        ...(dto.vaccinations !== undefined && { vaccinations: JSON.stringify(dto.vaccinations) }),
      },
    });

    await this.cache.invalidate(`member:${memberId}:*`);
    this.eventBus.publish(EVENTS.HEALTH_RECORD_UPDATED, { memberId, userId });

    return record;
  }

  /**
   * 管理慢病史（全量替换 JSONB）
   */
  async updateChronicDiseases(
    memberId: string,
    userId: string,
    dto: UpdateChronicDiseasesDto,
  ) {
    await this.verifyMemberAccess(memberId, userId, true);

    const chronicDiseases = JSON.stringify(dto.diseases ?? []);
    const record = await this.prisma.healthRecord.upsert({
      where: { memberId },
      create: { memberId, ...HEALTH_RECORD_JSON_DEFAULTS, chronicDiseases },
      update: { chronicDiseases },
    });

    await this.cache.invalidate(`member:${memberId}:*`);
    this.eventBus.publish(EVENTS.HEALTH_RECORD_CHRONIC_UPDATED, {
      memberId,
      userId,
      diseaseCount: dto.diseases.length,
    });

    return record;
  }

  /**
   * 管理过敏史（全量替换 JSONB）
   */
  async updateAllergies(
    memberId: string,
    userId: string,
    dto: UpdateAllergiesDto,
  ) {
    await this.verifyMemberAccess(memberId, userId, true);

    const allergies = JSON.stringify(dto.allergies ?? []);
    const record = await this.prisma.healthRecord.upsert({
      where: { memberId },
      create: { memberId, ...HEALTH_RECORD_JSON_DEFAULTS, allergies },
      update: { allergies },
    });

    await this.cache.invalidate(`member:${memberId}:*`);
    this.eventBus.publish(EVENTS.HEALTH_RECORD_ALLERGIES_UPDATED, {
      memberId,
      userId,
      allergyCount: (dto.allergies ?? []).length,
    });

    return record;
  }

  /**
   * 管理手术史（全量替换，JSON 字符串存储）
   */
  async updateSurgeries(memberId: string, userId: string, dto: UpdateSurgeriesDto) {
    await this.verifyMemberAccess(memberId, userId, true);

    const surgeries = JSON.stringify(dto.surgeries ?? []);
    const record = await this.prisma.healthRecord.upsert({
      where: { memberId },
      create: { memberId, ...HEALTH_RECORD_JSON_DEFAULTS, surgeries },
      update: { surgeries },
    });

    await this.cache.invalidate(`member:${memberId}:*`);
    this.eventBus.publish(EVENTS.HEALTH_RECORD_SURGERIES_UPDATED, {
      memberId,
      userId,
      count: (dto.surgeries ?? []).length,
    });

    return record;
  }

  /**
   * 管理家族史（全量替换，JSON 字符串存储）
   */
  async updateFamilyHistory(memberId: string, userId: string, dto: UpdateFamilyHistoryDto) {
    await this.verifyMemberAccess(memberId, userId, true);

    const familyHistory = JSON.stringify(dto.familyHistory ?? []);
    const record = await this.prisma.healthRecord.upsert({
      where: { memberId },
      create: { memberId, ...HEALTH_RECORD_JSON_DEFAULTS, familyHistory },
      update: { familyHistory },
    });

    await this.cache.invalidate(`member:${memberId}:*`);
    this.eventBus.publish(EVENTS.HEALTH_RECORD_FAMILY_HISTORY_UPDATED, {
      memberId,
      userId,
      count: (dto.familyHistory ?? []).length,
    });

    return record;
  }

  /**
   * 管理疫苗接种史（全量替换，JSON 字符串存储）
   */
  async updateVaccinations(memberId: string, userId: string, dto: UpdateVaccinationsDto) {
    await this.verifyMemberAccess(memberId, userId, true);

    const vaccinations = JSON.stringify(dto.vaccinations ?? []);
    const record = await this.prisma.healthRecord.upsert({
      where: { memberId },
      create: { memberId, ...HEALTH_RECORD_JSON_DEFAULTS, vaccinations },
      update: { vaccinations },
    });

    await this.cache.invalidate(`member:${memberId}:*`);
    this.eventBus.publish(EVENTS.HEALTH_RECORD_VACCINATIONS_UPDATED, {
      memberId,
      userId,
      count: (dto.vaccinations ?? []).length,
    });

    return record;
  }

  /**
   * 导出健康档案（生成 PDF 数据结构）
   */
  async exportRecord(memberId: string, userId: string) {
    await this.verifyMemberAccess(memberId, userId);

    const record = await this.prisma.healthRecord.findUnique({
      where: { memberId },
      include: {
        member: {
          select: { nickname: true, age: true, gender: true },
        },
      },
    });

    if (!record) throw new NotFoundException('健康档案不存在');

    // 获取最近 3 次自评结果
    const recentAssessments = await this.prisma.assessment.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        type: true,
        totalScore: true,
        topConcerns: true,
        completedAt: true,
      },
    });

    return {
      member: record.member,
      healthInfo: {
        bloodType: record.bloodType,
        heightCm: record.heightCm,
        weightKg: record.weightKg,
        chronicDiseases: record.chronicDiseases,
        allergies: record.allergies,
        surgeries: record.surgeries,
        familyHistory: record.familyHistory,
        lastCheckupDate: record.lastCheckupDate,
        checkupSummary: record.checkupSummary,
      },
      recentAssessments,
      exportedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // 权限：通过 memberId 查找 family，验证 userId 是否在家庭中
  // ============================================================

  private async verifyMemberAccess(memberId: string, userId: string, write = false) {
    const member = await this.prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('成员不存在');
    const membership = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId: member.familyId, userId } },
    });
    if (!membership) throw new ForbiddenException('无权访问该成员的档案');
    if (write) this.policy.authorize({ action: 'health:write', actor: membership, target: member });
  }
}
