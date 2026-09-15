import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadAvailabilityGuard } from './upload-availability.guard';

@Module({
  controllers: [UploadController],
  providers: [UploadService, UploadAvailabilityGuard],
  exports: [UploadService],
})
export class UploadModule {}
