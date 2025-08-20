import { Inject, Injectable, Logger } from '@nestjs/common';
import { ICacheManager, CacheMemoryInfo, CleanupResult } from '../../core/interfaces/cache/cache-manager.interface';
import type { ICacheStrategy } from '../../core/interfaces/cache/cache-strategy.interface';

@Injectable()
export class CacheManagerService implements ICacheManager {
  private readonly logger = new Logger(CacheManagerService.name);
  private readonly defaultMemoryThreshold = 50 * 1024 * 1024; // 50MB default

  constructor(@Inject('ICacheStrategy') private readonly cacheStrategy: ICacheStrategy) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cacheStrategy.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cacheStrategy.set(key, value, ttl);
  }

  async delete(key: string): Promise<boolean> {
    return this.cacheStrategy.delete(key);
  }

  async clear(): Promise<void> {
    return this.cacheStrategy.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.cacheStrategy.has(key);
  }

  async getMemoryUsage(): Promise<CacheMemoryInfo> {
    if (this.cacheStrategy.getMemoryUsage) {
      return this.cacheStrategy.getMemoryUsage();
    }

    // Fallback for strategies that don't implement memory monitoring
    this.logger.warn('Cache strategy does not implement memory monitoring, using fallback');
    return {
      estimatedBytes: 0,
      entryCount: 0,
      utilizationRate: 0,
      hitRate: 0,
    };
  }

  async isMemoryThresholdExceeded(threshold?: number): Promise<boolean> {
    const memoryInfo = await this.getMemoryUsage();
    const thresholdBytes = threshold || this.defaultMemoryThreshold;
    
    const exceeded = memoryInfo.estimatedBytes > thresholdBytes;
    
    if (exceeded) {
      this.logger.warn(
        `Cache memory threshold exceeded: ${this.formatBytes(memoryInfo.estimatedBytes)} > ${this.formatBytes(thresholdBytes)}`
      );
    }

    return exceeded;
  }

  async cleanup(aggressive = false): Promise<CleanupResult> {
    if (this.cacheStrategy.cleanup) {
      const result = await this.cacheStrategy.cleanup(aggressive);
      
      this.logger.log(
        `Cache cleanup ${aggressive ? '(aggressive)' : ''}: ` +
        `${result.entriesRemoved} entries removed, ` +
        `${this.formatBytes(result.memoryFreed)} freed in ${result.duration}ms`
      );
      
      return result;
    }

    // Fallback to basic clear if strategy doesn't implement cleanup
    this.logger.warn('Cache strategy does not implement cleanup, falling back to clear()');
    await this.clear();
    
    return {
      entriesRemoved: 0,
      memoryFreed: 0,
      duration: 0,
    };
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}
