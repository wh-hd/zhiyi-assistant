import { ForbiddenException } from '@nestjs/common';
import { FamilyPolicyService } from '../../src/common/policies/family-policy.service';

describe('FamilyPolicyService', () => {
  const service = new FamilyPolicyService();
  const member = { id: 'm1', familyId: 'f1', userId: 'u1', role: 'member' } as never;
  it('forbids ordinary members from creating members or changing roles', () => {
    expect(() => service.authorize({ actor: member, action: 'member:create' })).toThrow(ForbiddenException);
    expect(() => service.authorize({ actor: member, action: 'role:update', target: member })).toThrow(ForbiddenException);
  });
});
