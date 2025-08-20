export interface ICacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  
  // Memory monitoring capabilities
  getMemoryUsage(): Promise<CacheMemoryInfo>;
  isMemoryThresholdExceeded(threshold?: number): Promise<boolean>;
  cleanup(aggressive?: boolean): Promise<CleanupResult>;
}

export interface CacheMemoryInfo {
  estimatedBytes: number;
  entryCount: number;
  utilizationRate: number;
  hitRate: number;
  lastCleanup?: Date;
}

export interface CleanupResult {
  entriesRemoved: number;
  memoryFreed: number;
  duration: number;
}
