export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  hitRatio: number;
  memoryUsage: number;
  peakMemoryUsage: number;
  cacheSize: number;
  currentSize: number;
  maxSize: number;
  lastAccess: Date | null;
  lastHit: number;
  lastMiss: number;
  lastEviction: number;
  lastMemoryUpdate: number;
  startTime: number;
  uptime: number;
}
