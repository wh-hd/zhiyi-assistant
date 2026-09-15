import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('APP_PORT', 3000);
  const adminIds = configService
    .get<string>('ADMIN_USER_IDS', '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const alertChannel = configService.get<string>(
    'SECURITY_ALERT_CHANNEL',
    nodeEnv === 'production' ? 'disabled' : 'log',
  );
  const alertWebhookConfigured = Boolean(
    configService.get<string>('SECURITY_ALERT_WEBHOOK_URL', '').trim(),
  );
  logger.log(
    `管理员写权限配置: enabled=${adminIds.length > 0}, count=${adminIds.length}`,
  );
  if (nodeEnv === 'production' && (alertChannel !== 'webhook' || !alertWebhookConfigured)) {
    logger.error('生产安全告警必须启用 webhook 并配置目标');
    throw new Error('生产安全告警配置无效');
  }

  // ---- 全局安全中间件 ----
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'http://localhost:3000', 'http://127.0.0.1:3000'],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(cookieParser());

  // ---- CORS ----
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '').split(',');
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    maxAge: 86400,
  });

  // ---- 全局管道 ----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // ---- 全局过滤器 & 拦截器 ----
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TransformInterceptor(),
    new PerformanceInterceptor(),
  );

  // ---- 全局前缀 ----
  app.setGlobalPrefix('v1', {
    exclude: ['health'], // 健康检查不走前缀
  });

  // ---- 静态资源（public 目录：prototype.html / test.html / runtime-config.js 等） ----
  // HTML 不缓存：避免 ?v= 版本号更新后仍被旧 HTML 入口引用旧 JS
  // JS/CSS 可长期缓存：通过 query string 版本号控制失效
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });

  // ---- Swagger (非生产环境) ----
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('智医助手 API')
      .setDescription('AI 家庭健康管理助手后端接口文档')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addServer(`http://localhost:${port}`, '本地开发')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }

  // ---- 启动 ----
  await app.listen(port);
  logger.log(`🚀 智医助手 API 已启动 → http://localhost:${port}/v1`);
  logger.log(`📋 环境: ${nodeEnv} | 端口: ${port}`);
}
void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown bootstrap error';
  new Logger('Bootstrap').error(message);
  process.exitCode = 1;
});
