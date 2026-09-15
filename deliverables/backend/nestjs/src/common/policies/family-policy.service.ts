import { ForbiddenException, Injectable } from '@nestjs/common';
import { FamilyMember } from '@prisma/client';
import { FamilyPolicyContext } from './family-policy.types';

@Injectable()
export class FamilyPolicyService {
  authorize(context: FamilyPolicyContext): void {
    if (['family:update', 'member:create', 'member:delete', 'role:update'].includes(context.action)) {
      this.assertAdmin(context.actor);
      return;
    }
    if (context.action === 'member:update' || context.action === 'health:write') {
      if (!context.target || !this.canWriteTarget(context.actor, context.target)) {
        throw new ForbiddenException('无权修改其他成员的数据');
      }
    }
  }

  canWriteTarget(actor: FamilyMember, target: FamilyMember): boolean {
    return actor.role === 'admin' || (actor.userId !== null && actor.userId === target.userId);
  }

  assertAdmin(actor: FamilyMember): void {
    if (actor.role !== 'admin') throw new ForbiddenException('仅家庭管理员可执行此操作');
  }
}
