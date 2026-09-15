import {
  Injectable, Logger, NotFoundException,
  ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EventBusService } from '../../shared/events/event-bus.service';
import { EVENTS } from '../../shared/events/events.constants';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { FamilyPolicyService } from '../../common/policies/family-policy.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class FamilyService {
  private readonly logger = new Logger(FamilyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBusService,
    private readonly policy: FamilyPolicyService,
  ) {}

  // ============================================================
  // 家庭 CRUD
  // ============================================================

  async create(userId: string, dto: CreateFamilyDto) {
    const family = await this.prisma.family.create({
      data: {
        name: dto.name,
        createdBy: userId,
        memberCount: 1,
        // 自动为创建者添加为管理员成员
        members: {
          create: {
            userId,
            role: 'admin',
            nickname: '我',
            relation: 'self',
            isPrimary: true,
            sortOrder: 0,
            healthRecord: {
              create: {
                chronicDiseases: '[]',
                allergies: '[]',
                surgeries: '[]',
                familyHistory: '[]',
                vaccinations: '[]',
              },
            },
          },
        },
      },
      include: { members: true },
    });

    await this.cache.invalidate(`user:${userId}:families:*`);
    this.eventBus.publish(EVENTS.FAMILY_CREATED, { familyId: family.id, userId });

    return family;
  }

  async findById(familyId: string, userId: string) {
    await this.ensureMembership(familyId, userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          orderBy: { sortOrder: 'asc' },
        },
        creator: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });

    if (!family) throw new NotFoundException('家庭不存在');
    return family;
  }

  async findByUser(userId: string) {
    return this.cache.getOrSet(
      `user:${userId}:families:list`,
      300, // 5 min TTL，家庭成员关系变更低频，可承受
      async () => {
        const memberships = await this.prisma.familyMember.findMany({
          where: { userId },
          include: {
            family: {
              include: {
                members: {
                  orderBy: { sortOrder: 'asc' },
                  take: 6, // 预览前 6 个成员
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
        return memberships.map((m) => ({
          role: m.role,
          ...m.family,
        }));
      },
    );
  }

  async update(familyId: string, userId: string, dto: UpdateFamilyDto) {
    await this.ensureAdmin(familyId, userId);

    const family = await this.prisma.family.update({
      where: { id: familyId },
      data: { name: dto.name },
    });

    await this.cache.invalidate(`family:${familyId}:*`);
    this.eventBus.publish(EVENTS.FAMILY_UPDATED, { familyId, userId });

    return family;
  }

  // ============================================================
  // 成员管理
  // ============================================================

  async getMembers(familyId: string, userId: string) {
    await this.ensureMembership(familyId, userId);
    return this.cache.getOrSet(
      `family:${familyId}:members`,
      120, // 2 min TTL，成员 CRUD 时显式失效
      async () => this.prisma.familyMember.findMany({
        where: { familyId },
        orderBy: { sortOrder: 'asc' },
        include: {
          healthRecord: {
            select: {
              bloodType: true, chronicDiseases: true, allergies: true,
              surgeries: true, familyHistory: true, vaccinations: true,
              heightCm: true, weightKg: true,
              lastAssessmentScore: true, lastAssessmentDate: true,
            },
          },
        },
      }),
    );
  }

  async addMember(familyId: string, userId: string, dto: AddMemberDto) {
    const actor = await this.ensureMembership(familyId, userId);
    this.policy.authorize({ actor, action: 'member:create' });

    // 检查是否已存在（按 userId）
    if (dto.userId) {
      const existing = await this.prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: dto.userId } },
      });
      if (existing) throw new ConflictException('该用户已是家庭成员');
    }

    let member: any = null;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts && !member) {
      attempts++;
      const maxSort = await this.prisma.familyMember.aggregate({
        where: { familyId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + attempts; // 重试时递增，避免 TiDB 读旧值导致唯一冲突
      try {
        member = await this.prisma.familyMember.create({
          data: {
            familyId,
            userId: dto.userId,
            role: dto.role ?? 'member',
            nickname: dto.nickname,
            relation: dto.relation ?? 'other',
            age: dto.age,
            gender: dto.gender,
            avatarUrl: dto.avatarUrl,
            sortOrder,
            healthRecord: {
              create: {
                chronicDiseases: '[]',
                allergies: '[]',
                surgeries: '[]',
                familyHistory: '[]',
                vaccinations: '[]',
              },
            },
          },
        });
      } catch (error) {
        if (attempts >= maxAttempts) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          this.logger.warn(`家庭 ${familyId} 添加成员 sortOrder 冲突，第 ${attempts} 次重试`);
          member = null;
        } else {
          throw error;
        }
      }
    }
    // memberCount 与主创建解耦：TiDB 高延迟下 interactive transaction 容易 5s 超时，
    // 单条嵌套 create 由 Prisma/数据库保证原子性；计数失败也不影响成员已创建。
    try {
      const memberCount = await this.prisma.familyMember.count({ where: { familyId } });
      await this.prisma.family.update({ where: { id: familyId }, data: { memberCount } });
    } catch (countError) {
      this.logger.warn(`更新家庭 ${familyId} 成员计数失败，不影响成员创建`, countError);
    }

    await this.cache.invalidate(`family:${familyId}:*`);
    await this.cache.invalidate(`user:${userId}:families:*`);
    this.eventBus.publish(EVENTS.FAMILY_MEMBER_ADDED, {
      familyId, memberId: member.id, userId,
    });

    return member;
  }

  async getMemberDetail(familyId: string, memberId: string, userId: string) {
    await this.ensureMembership(familyId, userId);
    return this.cache.getOrSet(
      `family:${familyId}:member:${memberId}:detail`,
      120, // 2 min TTL，成员更新/删除时显式失效
      async () => {
        const member = await this.prisma.familyMember.findFirst({
          where: { id: memberId, familyId },
          include: {
            healthRecord: true,
            user: { select: { id: true, nickname: true, avatarUrl: true, phone: true } },
          },
        });
        if (!member) throw new NotFoundException('成员不存在');
        return member;
      },
    );
  }

  async updateMember(
    familyId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberDto,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const [actor, member] = await Promise.all([
        tx.familyMember.findUnique({
          where: { familyId_userId: { familyId, userId } },
        }),
        tx.familyMember.findFirst({ where: { id: memberId, familyId } }),
      ]);
      if (!actor) throw new ForbiddenException('你不在该家庭中');
      if (!member) throw new NotFoundException('成员不存在');
      const roleChanged = Boolean(dto.role && dto.role !== member.role);
      if (roleChanged) {
        this.policy.authorize({ actor, action: 'role:update', target: member });
        if (member.role === 'admin' && dto.role !== 'admin') {
          const adminCount = await tx.familyMember.count({ where: { familyId, role: 'admin' } });
          if (adminCount <= 1) throw new ConflictException('不能降级最后一个管理员');
        }
      } else {
        this.policy.authorize({ actor, action: 'member:update', target: member });
        if (dto.sortOrder !== undefined && actor.role !== 'admin') {
          throw new ForbiddenException('仅家庭管理员可调整成员排序');
        }
      }
      const result = await tx.familyMember.update({
        where: { id: memberId },
        data: {
          ...(dto.nickname && { nickname: dto.nickname }),
          ...(dto.relation && { relation: dto.relation }),
          ...(dto.age !== undefined && { age: dto.age }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.avatarUrl && { avatarUrl: dto.avatarUrl }),
          ...(dto.role && { role: dto.role }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
      if (roleChanged && dto.role) {
        await tx.familyRoleAudit.create({
          data: {
            familyId, actorUserId: userId, targetMemberId: memberId,
            oldRole: member.role, newRole: dto.role, action: 'role:update',
            requestId: `role-${randomUUID()}`,
          },
        });
      }
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });

    await this.cache.invalidate(`family:${familyId}:*`);
    await this.cache.invalidate(`member:${memberId}:*`);

    return updated;
  }

  async removeMember(familyId: string, memberId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const [actor, member] = await Promise.all([
        tx.familyMember.findUnique({
          where: { familyId_userId: { familyId, userId } },
        }),
        tx.familyMember.findFirst({ where: { id: memberId, familyId } }),
      ]);
      if (!actor) throw new ForbiddenException('你不在该家庭中');
      this.policy.authorize({ actor, action: 'member:delete' });
      if (!member) throw new NotFoundException('成员不存在');
      if (member.isPrimary) throw new ForbiddenException('不能移除家庭主成员');
      if (member.role === 'admin') {
        const adminCount = await tx.familyMember.count({ where: { familyId, role: 'admin' } });
        if (adminCount <= 1) throw new ConflictException('不能移除最后一个管理员');
      }
      await tx.familyMember.delete({ where: { id: memberId } });
      const memberCount = await tx.familyMember.count({ where: { familyId } });
      await tx.family.update({ where: { id: familyId }, data: { memberCount } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });

    await this.cache.invalidate(`family:${familyId}:*`);
    this.eventBus.publish(EVENTS.FAMILY_MEMBER_REMOVED, {
      familyId, memberId, userId,
    });

    return { success: true };
  }

  // ============================================================
  // 权限校验辅助
  // ============================================================

  private async ensureMembership(familyId: string, userId: string) {
    const key = `membership:${familyId}:${userId}`;
    const membership = await this.cache.getOrSet(
      key,
      120, // 2 min TTL，成员关系变更低频；CRUD 时显式失效
      async () => {
        const m = await this.prisma.familyMember.findUnique({
          where: { familyId_userId: { familyId, userId } },
        });
        if (!m) throw new ForbiddenException('你不在该家庭中');
        return m;
      },
    );
    return membership;
  }

  private async ensureAdmin(familyId: string, userId: string) {
    const membership = await this.ensureMembership(familyId, userId);
    if (membership.role !== 'admin') {
      throw new ForbiddenException('仅家庭管理员可执行此操作');
    }
  }
}
