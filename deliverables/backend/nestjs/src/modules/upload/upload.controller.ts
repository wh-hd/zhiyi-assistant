import {
  Controller, Post, UseGuards, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadAvailabilityGuard } from './upload-availability.guard';

// 本地声明上传文件结构 (避免依赖 @types/multer)
interface UploadedFileShape {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('文件上传')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UploadAvailabilityGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post('avatar')
  @ApiOperation({ summary: '上传头像/图片 (返回可访问 URL)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @Req() req: any,
    @UploadedFile() file: UploadedFileShape,
  ) {
    return this.service.save(file, req.user.id, {
      subdir: 'avatars',
      allowedPrefix: 'image/',
      maxSize: 5 * 1024 * 1024,
    });
  }

  @Post()
  @ApiOperation({ summary: '通用文件上传 (图片/文档/PDF)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @Req() req: any,
    @UploadedFile() file: UploadedFileShape,
  ) {
    const result = await this.service.save(file, req.user.id, {
      subdir: 'files',
      maxSize: 10 * 1024 * 1024,
    });
    return { ...result, originalname: file.originalname };
  }
}
