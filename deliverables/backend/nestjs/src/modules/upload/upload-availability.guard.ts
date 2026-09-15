import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadAvailabilityGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.get<boolean>('UPLOAD_ENABLED', false)) {
      throw new ServiceUnavailableException({ code: 'CAPABILITY_DISABLED', message: '私有上传能力尚未启用' });
    }
    return true;
  }
}
