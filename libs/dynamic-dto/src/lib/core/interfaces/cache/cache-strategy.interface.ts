import type { CacheMemoryInfo, CleanupResult } from './cache-manager.interface';

export interface ICacheStrategy {
  get<T>(key: string): T | null | Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): void | Promise<void>;
  delete(key: string): boolean | Promise<boolean>;
  clear(): void | Promise<void>;
  has(key: string): boolean | Promise<boolean>;

  // Memory monitoring capabilities
  getMemoryUsage?(): CacheMemoryInfo | Promise<CacheMemoryInfo>;
  cleanup?(aggressive?: boolean): CleanupResult | Promise<CleanupResult>;
}
