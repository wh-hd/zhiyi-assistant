import { Module, Global } from '@nestjs/common';
import { LocalJsonStorageService } from './local-json-storage.service';

@Global()
@Module({
  providers: [LocalJsonStorageService],
  exports: [LocalJsonStorageService],
})
export class LocalJsonStorageModule {}
