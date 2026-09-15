import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  /** 校验当前用户是否属于该家庭（否则无权操作） */
  private async verifyFamilyAccess(familyId: string, userId: string): Promise<void> {
    const actor = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });
    if (!actor) throw new ForbiddenException('无权访问该家庭的待办事项');
  }

  private toWhere(familyId: string, done?: string): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { familyId };
    if (done === 'true') where.done = true;
    else if (done === 'false') where.done = false;
    return where;
  }

  async list(familyId: string, userId: string, done?: string): Promise<Task[]> {
    await this.verifyFamilyAccess(familyId, userId);
    return this.prisma.task.findMany({
      where: this.toWhere(familyId, done),
      orderBy: [{ done: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateTaskDto, userId: string): Promise<Task> {
    if (!dto.familyId) throw new BadRequestException('familyId is required');
    await this.verifyFamilyAccess(dto.familyId, userId);
    if (dto.memberId) {
      const member = await this.prisma.familyMember.findUnique({ where: { id: dto.memberId } });
      if (!member || member.familyId !== dto.familyId) {
        throw new BadRequestException('memberId 不属于该家庭');
      }
    }
    return this.prisma.task.create({
      data: {
        familyId: dto.familyId,
        memberId: dto.memberId ?? null,
        title: dto.title,
        detail: dto.detail ?? null,
        icon: dto.icon ?? null,
        iconBg: dto.iconBg ?? null,
        iconStroke: dto.iconStroke ?? null,
        done: dto.done ?? false,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto, userId: string): Promise<Task> {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('待办事项不存在');
    await this.verifyFamilyAccess(existing.familyId, userId);
    if (dto.memberId !== undefined && dto.memberId) {
      const member = await this.prisma.familyMember.findUnique({ where: { id: dto.memberId } });
      if (!member || member.familyId !== existing.familyId) {
        throw new BadRequestException('memberId 不属于该家庭');
      }
    }
    return this.prisma.task.update({
      where: { id },
      data: {
        memberId: dto.memberId === undefined ? undefined : (dto.memberId ?? null),
        title: dto.title,
        detail: dto.detail,
        icon: dto.icon,
        iconBg: dto.iconBg,
        iconStroke: dto.iconStroke,
        done: dto.done,
        dueDate: dto.dueDate === undefined ? undefined : (dto.dueDate ? new Date(dto.dueDate) : null),
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string, userId: string): Promise<{ id: string }> {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('待办事项不存在');
    await this.verifyFamilyAccess(existing.familyId, userId);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }
}
