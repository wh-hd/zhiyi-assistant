import { Global, Module } from '@nestjs/common';
import { FamilyPolicyService } from './family-policy.service';

@Global()
@Module({ providers: [FamilyPolicyService], exports: [FamilyPolicyService] })
export class FamilyPolicyModule {}
