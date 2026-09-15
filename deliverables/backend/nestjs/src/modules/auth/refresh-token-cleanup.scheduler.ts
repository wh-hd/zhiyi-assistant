import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';

interface CleanupResult {
  deleted: number;
  batches: number;
}

@Injectable()
export class RefreshTokenCleanupScheduler {
  private readonly logger = new Logger(RefreshTokenCleanupScheduler.name);
  private readonly batchSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const configured = Number(
      this.configService.get<string | number>('REFRESH_TOKEN_CLEANUP_BATCH_SIZE', 500),
    );
    this.batchSize = Number.isInteger(configured) && configured >= 50 && configured <= 5000
      ? configured
      : 500;
  }

  @Cron('0 30 3 * * *', { timeZone: 'Asia/Shanghai' })
  async handleExpiredTokenCleanup(): Promise<void> {
    const startedAt = Date.now();
    const cutoff = new Date();
    this.logger.log(`过期 refresh token 清理开始 cutoff=${cutoff.toISOString()} batchSize=${this.batchSize}`);
    try {
      const result = await this.deleteExpiredInBatches(cutoff);
      this.logger.log(
        `过期 refresh token 清理完成 deleted=${result.deleted} batches=${result.batches} durationMs=${Date.now() - startedAt}`,
      );
    } catch (error) {
      const type = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `过期 refresh token 清理失败 type=${type} durationMs=${Date.now() - startedAt}`,
      );
    }
  }

  private async deleteExpiredInBatches(cutoff: Date): Promise<CleanupResult> {
    let deleted = 0;
    let batches = 0;
    while (true) {
      const records = await this.prisma.refreshToken.findMany({
        where: { expiresAt: { lt: cutoff } },
        orderBy: { expiresAt: 'asc' },
        take: this.batchSize,
        select: { id: true },
      });
      if (records.length === 0) break;
      const ids = records.map((record) => record.id);
      const result = await this.prisma.refreshToken.deleteMany({
        where: { id: { in: ids }, expiresAt: { lt: cutoff } },
      });
      deleted += result.count;
      batches += 1;
      if (records.length < this.batchSize) break;
      // A competing instance may delete the full page first. Continue a bounded
      // number of times instead of treating count=0 as end-of-data.
      if (result.count === 0 && batches >= 100) break;
    }
    return { deleted, batches };
  }
}
