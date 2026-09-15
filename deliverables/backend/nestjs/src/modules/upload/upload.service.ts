import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

// multer 文件结构 (运行时由 @nestjs/platform-express 提供，类型以本地接口声明)
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly PUBLIC_ROOT = join(process.cwd(), 'public');
  private readonly UPLOAD_ROOT = join(this.PUBLIC_ROOT, 'uploads');

  /**
   * 保存上传文件到 public/uploads/<subdir>/<userId>/ 并返回可访问 URL
   */
  async save(
    file: UploadedFile,
    userId: string,
    opts: { subdir?: string; allowedPrefix?: string; maxSize?: number } = {},
  ): Promise<{ url: string; filename: string; size: number; mimetype: string }> {
    if (!file || !file.buffer) throw new BadRequestException('未收到文件');

    const maxSize = opts.maxSize ?? 10 * 1024 * 1024; // 默认 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(`文件过大，上限 ${Math.floor(maxSize / 1024 / 1024)}MB`);
    }

    if (opts.allowedPrefix && !file.mimetype.startsWith(opts.allowedPrefix)) {
      throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    }

    const subdir = opts.subdir ?? 'misc';
    const dir = join(this.UPLOAD_ROOT, subdir, userId);
    await fs.mkdir(dir, { recursive: true });

    const ext = this.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const fullPath = join(dir, safeName);
    await fs.writeFile(fullPath, file.buffer);

    // 静态资源由 NestExpressApplication 从 public/ 提供
    const url = `/uploads/${subdir}/${userId}/${safeName}`;
    this.logger.log(`文件已保存: ${url} (${file.size} bytes)`);

    return { url, filename: safeName, size: file.size, mimetype: file.mimetype };
  }

  private extname(name: string): string {
    const idx = name.lastIndexOf('.');
    if (idx < 0) return '';
    const ext = name.slice(idx).toLowerCase();
    // 仅允许常见安全扩展名
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.csv', '.json'];
    return allowed.includes(ext) ? ext : '.bin';
  }
}
