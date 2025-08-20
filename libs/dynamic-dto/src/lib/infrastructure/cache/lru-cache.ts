/**
 * Least Recently Used (LRU) cache implementation with configurable size limits
 * and memory monitoring to prevent unbounded cache growth
 */
export class LRUCache<K, V> {
  private readonly cache = new Map<K, V>();
  private readonly maxSize: number;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(maxSize = 1000) {
    if (maxSize <= 0) {
      throw new Error('LRU cache maxSize must be greater than 0');
    }
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hitCount++;
      return value;
    }

    this.missCount++;
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing key and move to end
      this.cache.delete(key);
      this.cache.set(key, value);
      return;
    }

    // Check if we need to evict
    if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.cache.keys().next().value as K;
      this.cache.delete(firstKey);
      this.evictionCount++;
    }

    this.cache.set(key, value);
  }

  has(key: K): boolean {
    const exists = this.cache.has(key);
    if (exists) {
      // Move to end if it exists (accessing counts as usage)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return exists;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats {
    const totalAccesses = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      hitRate: totalAccesses > 0 ? this.hitCount / totalAccesses : 0,
      utilizationRate: this.cache.size / this.maxSize,
    };
  }

  /**
   * Check if cache is approaching memory limits
   */
  isNearCapacity(threshold = 0.9): boolean {
    return this.cache.size / this.maxSize >= threshold;
  }

  /**
   * Get memory usage estimate in bytes (approximate)
   */
  getApproximateMemoryUsage(): number {
    // Rough estimate: each Map entry has overhead + key + value
    // This is a simplified calculation
    const entryOverhead = 32; // Approximate overhead per Map entry
    const keySize = 50; // Average key size estimate
    const valueSize = 1000; // Average value size estimate (class constructors)

    return this.cache.size * (entryOverhead + keySize + valueSize);
  }
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  utilizationRate: number;
}
