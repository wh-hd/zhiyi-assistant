import { Injectable, Logger } from '@nestjs/common';
import NodeCache = require('node-cache');

/**
 * 多级缓存服务
 * L2 (应用内存 LRU) — TTL 1-5分钟，热点数据
 * L3 (Redis) — 待集成，TTL 5-30分钟
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly memoryCache: NodeCache;

  constructor() {
    this.memoryCache = new NodeCache({
      stdTTL: 300,          // 默认5分钟
      checkperiod: 60,      // 60秒检查一次过期
      useClones: false,     // 性能优化：不深拷贝
      maxKeys: 10000,       // 最多缓存10000个Key
    });
  }

  /**
   * Cache-Aside 模式：先从缓存读，未命中则调用 factory 写入缓存
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.memoryCache.get<T>(key);
    if (cached !== undefined) {
      return this.clone(cached);
    }

    const data = await factory();
    this.memoryCache.set(key, data, ttlSeconds);
    return this.clone(data);
  }

  get<T>(key: string): T | undefined {
    const value = this.memoryCache.get<T>(key);
    return value === undefined ? undefined : this.clone(value);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    this.memoryCache.set(key, value, ttlSeconds ?? 300);
  }

  /**
   * 删除匹配 pattern 的所有缓存 Key
   * 生产环境：使用 Redis SCAN + Pipeline
   */
  invalidate(pattern: string): void {
    const allKeys = this.memoryCache.keys();
    const matched = allKeys.filter((k) =>
      pattern.endsWith('*')
        ? k.startsWith(pattern.replace('*', ''))
        : k === pattern,
    );
    if (matched.length > 0) {
      this.memoryCache.del(matched);
      this.logger.debug(`缓存失效: ${matched.length} keys matched "${pattern}"`);
    }
  }

  /**
   * 深拷贝缓存值，避免调用方通过共享引用污染缓存（B5 修复）
   * 保留 useClones:false 的写入性能，仅在读取时克隆
   * 对含函数/不可序列化对象的数据回退到 JSON 深拷贝
   */
  private clone<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    try {
      return structuredClone(value);
    } catch (e) {
      this.logger.warn('structuredClone 失败，回退 JSON 深拷贝', e);
      return JSON.parse(JSON.stringify(value));
    }
  }

  /**
   * 缓存统计
   */
  getStats() {
    return this.memoryCache.getStats();
  }
}
