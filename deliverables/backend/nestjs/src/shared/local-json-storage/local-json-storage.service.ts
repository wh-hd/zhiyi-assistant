import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Local JSON 文件存储服务
 * 用于将完整 AI 咨询对话记录以 JSON 文件形式保存到项目 tmp 目录，
 * 数据库中仅保留关键索引信息。
 *
 * 目录结构：tmp/consultations/{userId}/{memberId}/{recordId}.json
 */
@Injectable()
export class LocalJsonStorageService {
  private readonly logger = new Logger(LocalJsonStorageService.name);
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    // 默认路径：项目根目录下的 tmp；可通过环境变量 LOCAL_JSON_DIR 覆盖
    this.baseDir =
      this.configService.get<string>('LOCAL_JSON_DIR') ||
      path.resolve(process.cwd(), 'tmp');
    this.ensureDir(this.baseDir);
  }

  /**
   * 保存用户对话记录到本地 JSON 文件
   * @param userId 用户 ID（用于隔离目录）
   * @param memberId 成员 ID
   * @param recordId 记录唯一 ID（consultationId）
   * @param data 完整对话数据
   * @returns 文件相对路径
   */
  async saveRecord(
    userId: string,
    memberId: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const dir = path.join(this.baseDir, 'consultations', userId, memberId);
    this.ensureDir(dir);
    const filePath = path.join(dir, `${recordId}.json`);
    const payload = {
      ...data,
      userId,
      memberId,
      recordId,
      storedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(payload, null, 2),
      'utf-8',
    );
    this.logger.debug(`咨询记录已保存到本地 JSON: ${filePath}`);
    return path.relative(this.baseDir, filePath);
  }

  /**
   * 读取单条完整记录
   */
  async readRecord(
    userId: string,
    memberId: string,
    recordId: string,
  ): Promise<Record<string, unknown> | null> {
    const filePath = path.join(
      this.baseDir,
      'consultations',
      userId,
      memberId,
      `${recordId}.json`,
    );
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      this.logger.error(`读取本地 JSON 记录失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 批量读取某成员下的记录（支持分页）
   * 按文件修改时间降序（最新的在前）
   * @returns { items, total }
   */
  async listRecords(
    userId: string,
    memberId: string,
    options: { skip?: number; take?: number } = {},
  ): Promise<{ items: Record<string, unknown>[]; total: number }> {
    const dir = path.join(this.baseDir, 'consultations', userId, memberId);
    if (!fs.existsSync(dir)) return { items: [], total: 0 };

    const files = (await fs.promises.readdir(dir))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ name: f, path: path.join(dir, f) }));

    // 按修改时间倒序（最新在前）
    const stats = await Promise.all(
      files.map(async (f) => ({ ...f, mtime: (await fs.promises.stat(f.path)).mtime.getTime() })),
    );
    stats.sort((a, b) => b.mtime - a.mtime);

    const total = stats.length;
    const skip = options.skip ?? 0;
    const take = options.take ?? stats.length;
    const pageFiles = stats.slice(skip, skip + take);

    const items = await Promise.all(
      pageFiles.map(async (f) => {
        const content = await fs.promises.readFile(f.path, 'utf-8');
        return JSON.parse(content) as Record<string, unknown>;
      }),
    );
    return { items, total };
  }

  /**
   * 删除单条记录
   */
  async deleteRecord(
    userId: string,
    memberId: string,
    recordId: string,
  ): Promise<boolean> {
    const filePath = path.join(
      this.baseDir,
      'consultations',
      userId,
      memberId,
      `${recordId}.json`,
    );
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      this.logger.error(`删除本地 JSON 记录失败: ${filePath}`, error);
      throw error;
    }
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
