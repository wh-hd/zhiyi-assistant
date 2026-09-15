import { FamilyMember } from '@prisma/client';

export type FamilyAction = 'family:update' | 'member:create' | 'member:delete' | 'member:update' | 'role:update' | 'health:write';
export interface FamilyPolicyContext {
  actor: FamilyMember;
  action: FamilyAction;
  target?: FamilyMember;
}
