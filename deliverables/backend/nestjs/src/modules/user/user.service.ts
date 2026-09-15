import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, nickname: true, avatarUrl: true, phone: true,
        gender: true, birthday: true, ageGroup: true,
        isElderlyMode: true, createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // 仅允许白名单字段，杜绝越权修改（如 wxOpenid / deletedAt）
    const data: {
      nickname?: string;
      avatarUrl?: string;
      phone?: string;
      isElderlyMode?: boolean;
    } = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.isElderlyMode !== undefined) data.isElderlyMode = dto.isElderlyMode;

    if (Object.keys(data).length === 0) {
      // 无可更新字段时直接返回当前用户，避免空 update
      return this.getProfile(userId);
    }
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  async getFamilies(userId: string) {
    return this.prisma.familyMember.findMany({
      where: { userId },
      include: { family: true },
    });
  }

  async getStats(userId: string) {
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId },
      select: { familyId: true },
    });
    const familyIds = [...new Set(memberships.map((m) => m.familyId))];
    if (!familyIds.length) {
      return {
        familyCount: 0,
        memberCount: 0,
        metricCount: 0,
        assessmentCount: 0,
        consultationCount: 0,
        healthRecordCount: 0,
      };
    }

    const memberIds = await this.prisma.familyMember.findMany({
      where: { familyId: { in: familyIds } },
      select: { id: true },
    });
    const ids = memberIds.map((m) => m.id);

    const [memberCount, metricCount, assessmentCount, consultationCount] = await Promise.all([
      this.prisma.familyMember.count({ where: { familyId: { in: familyIds } } }),
      this.prisma.healthMetric.count({ where: { memberId: { in: ids } } }),
      this.prisma.assessment.count({ where: { memberId: { in: ids } } }),
      this.prisma.consultation.count({ where: { memberId: { in: ids } } }),
    ]);

    return {
      familyCount: familyIds.length,
      memberCount,
      metricCount,
      assessmentCount,
      consultationCount,
      healthRecordCount: metricCount + assessmentCount,
    };
  }
}
