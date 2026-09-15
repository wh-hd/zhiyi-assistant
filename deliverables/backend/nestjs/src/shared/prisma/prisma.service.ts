import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL || '';
  if (!baseUrl) return baseUrl;

  const limit = process.env.DATABASE_CONNECTION_LIMIT || '20';
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT || '10';
  const connectTimeout = process.env.DATABASE_CONNECT_TIMEOUT || '15';

  // 始终用环境变量覆盖 URL 中的连接池参数，保证高并发场景下配置生效
  const url = new URL(baseUrl);
  url.searchParams.set('connection_limit', limit);
  url.searchParams.set('pool_timeout', poolTimeout);
  url.searchParams.set('connect_timeout', connectTimeout);
  return url.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: buildDatabaseUrl(),
        },
      },
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(`Prisma 数据库连接已建立 (URL: ${buildDatabaseUrl().replace(/:[^:@/]+@/, ':***@')})`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma 数据库连接已断开');
  }
}
