import { Injectable, Logger } from '@nestjs/common';
import { ICacheStrategy } from '../../../core/interfaces/cache/cache-strategy.interface';
import { CacheMemoryInfo, CleanupResult } from '../../../core/interfaces/cache/cache-manager.interface';

@Injectable()
export class MemoryCacheStrategy implements ICacheStrategy {
  private readonly logger = new Logger(MemoryCacheStrategy.name);
  private readonly cache = new Map<string, { value: unknown; expires?: number; size?: number; accessCount: number; lastAccess: number }>();
  private hitCount = 0;
  private missCount = 0;
  private lastCleanup?: Date;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    if (entry.expires && Date.now() > entry.expires) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.hitCount++;

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const estimatedSize = this.estimateObjectSize(value);
    const entry = {
      value,
      expires: ttl ? Date.now() + ttl * 1000 : 0,
      size: estimatedSize,
      accessCount: 0,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.lastCleanup = new Date();
  }

  has(key: string): boolean {
    const exists = this.cache.has(key);

    if (exists) {
      const entry = this.cache.get(key);
      if (entry?.expires && Date.now() > entry.expires) {
        this.cache.delete(key);
        return false;
      }
      // Update access tracking for has() calls
      if (entry) {
        entry.lastAccess = Date.now();
      }
    }

    return exists;
  }

  async getMemoryUsage(): Promise<CacheMemoryInfo> {
    // Clean up expired entries first
    this.cleanupExpired();

    const totalSize = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + (entry.size || 0),
      0
    );

    const totalAccesses = this.hitCount + this.missCount;
    const hitRate = totalAccesses > 0 ? this.hitCount / totalAccesses : 0;

    return {
      estimatedBytes: totalSize + this.cache.size * 100, // Add overhead estimate
      entryCount: this.cache.size,
      utilizationRate: this.cache.size / 1000, // Assuming max 1000 entries as default
      hitRate,
      lastCleanup: this.lastCleanup,
    };
  }

  async cleanup(aggressive = false): Promise<CleanupResult> {
    const startTime = Date.now();
    const initialMemory = await this.getMemoryUsage();

    let entriesRemoved = 0;

    // 1. Remove expired entries
    entriesRemoved += this.cleanupExpired();

    if (aggressive) {
      // 2. Remove least accessed entries if aggressive cleanup
      const entries = Array.from(this.cache.entries());
      
      // Sort by access count (ascending) and last access time (ascending)
      entries.sort(([, a], [, b]) => {
        if (a.accessCount === b.accessCount) {
          return a.lastAccess - b.lastAccess;
        }
        return a.accessCount - b.accessCount;
      });

      // Remove bottom 25% of least accessed entries
      const toRemove = Math.floor(entries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
        entriesRemoved++;
      }
    }

    const finalMemory = await this.getMemoryUsage();
    const duration = Date.now() - startTime;
    this.lastCleanup = new Date();

    const result: CleanupResult = {
      entriesRemoved,
      memoryFreed: initialMemory.estimatedBytes - finalMemory.estimatedBytes,
      duration,
    };

    if (entriesRemoved > 0) {
      this.logger.log(
        `Cache cleanup completed: ${entriesRemoved} entries removed, ` +
        `${this.formatBytes(result.memoryFreed)} freed in ${duration}ms`
      );
    }

    return result;
  }

  private cleanupExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires && now > entry.expires) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  private estimateObjectSize(obj: unknown): number {
    if (obj === null || obj === undefined) return 8;
    
    switch (typeof obj) {
      case 'boolean':
        return 4;
      case 'number':
        return 8;
      case 'string':
        return obj.length * 2; // Rough estimate for UTF-16
      case 'object':
        if (obj instanceof Date) return 24;
        if (Array.isArray(obj)) {
          return obj.reduce((sum, item) => sum + this.estimateObjectSize(item), 24);
        }
        // For complex objects (like class constructors), use a larger estimate
        return JSON.stringify(obj).length * 2 + 100; // Base object overhead
      default:
        return 50; // Default estimate for functions, symbols, etc.
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}
