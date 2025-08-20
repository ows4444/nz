import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheStats, LRUCache } from '../cache/lru-cache';

export interface CacheMonitorConfig {
  readonly memoryThresholdBytes?: number;
  readonly utilizationThreshold?: number;
  readonly hitRateThreshold?: number;
  readonly enableAlerting?: boolean;
  readonly alertingIntervalMs?: number;
}

@Injectable()
export class CacheMonitorService {
  private readonly logger = new Logger(CacheMonitorService.name);
  private readonly monitoredCaches = new Map<string, LRUCache<unknown, unknown>>();
  private readonly config: Required<CacheMonitorConfig>;
  private lastAlertTime = 0;

  constructor(config: CacheMonitorConfig = {}) {
    this.config = {
      memoryThresholdBytes: config.memoryThresholdBytes ?? 50 * 1024 * 1024, // 50MB
      utilizationThreshold: config.utilizationThreshold ?? 0.85, // 85%
      hitRateThreshold: config.hitRateThreshold ?? 0.7, // 70%
      enableAlerting: config.enableAlerting ?? true,
      alertingIntervalMs: config.alertingIntervalMs ?? 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Register a cache for monitoring
   */
  registerCache<K, V>(name: string, cache: LRUCache<K, V>): void {
    this.monitoredCaches.set(name, cache as LRUCache<unknown, unknown>);
    this.logger.log(`Registered cache '${name}' for monitoring`);
  }

  /**
   * Unregister a cache from monitoring
   */
  unregisterCache(name: string): void {
    this.monitoredCaches.delete(name);
    this.logger.log(`Unregistered cache '${name}' from monitoring`);
  }

  /**
   * Get current statistics for all monitored caches
   */
  getAllCacheStats(): Record<string, CacheStats & { memoryUsageBytes: number }> {
    const stats: Record<string, CacheStats & { memoryUsageBytes: number }> = {};

    for (const [name, cache] of this.monitoredCaches) {
      const cacheStats = cache.getStats();
      const memoryUsage = cache.getApproximateMemoryUsage();

      stats[name] = {
        ...cacheStats,
        memoryUsageBytes: memoryUsage,
      };
    }

    return stats;
  }

  /**
   * Check if any cache violates thresholds
   */
  checkCacheHealth(): CacheHealthReport {
    const issues: CacheIssue[] = [];
    const stats = this.getAllCacheStats();

    for (const [cacheName, cacheStats] of Object.entries(stats)) {
      // Check memory usage
      if (cacheStats.memoryUsageBytes > this.config.memoryThresholdBytes) {
        issues.push({
          cacheName,
          type: 'HIGH_MEMORY_USAGE',
          severity: 'WARNING',
          message: `Cache memory usage (${this.formatBytes(cacheStats.memoryUsageBytes)}) exceeds threshold (${this.formatBytes(this.config.memoryThresholdBytes)})`,
          value: cacheStats.memoryUsageBytes,
          threshold: this.config.memoryThresholdBytes,
        });
      }

      // Check utilization
      if (cacheStats.utilizationRate > this.config.utilizationThreshold) {
        issues.push({
          cacheName,
          type: 'HIGH_UTILIZATION',
          severity: 'WARNING',
          message: `Cache utilization (${(cacheStats.utilizationRate * 100).toFixed(1)}%) exceeds threshold (${(this.config.utilizationThreshold * 100).toFixed(1)}%)`,
          value: cacheStats.utilizationRate,
          threshold: this.config.utilizationThreshold,
        });
      }

      // Check hit rate
      if (cacheStats.hitRate < this.config.hitRateThreshold && cacheStats.hitCount + cacheStats.missCount > 10) {
        issues.push({
          cacheName,
          type: 'LOW_HIT_RATE',
          severity: 'INFO',
          message: `Cache hit rate (${(cacheStats.hitRate * 100).toFixed(1)}%) below threshold (${(this.config.hitRateThreshold * 100).toFixed(1)}%)`,
          value: cacheStats.hitRate,
          threshold: this.config.hitRateThreshold,
        });
      }
    }

    return {
      timestamp: new Date(),
      healthy: issues.length === 0,
      issues,
      stats,
    };
  }

  /**
   * Periodic cache health check (runs every 5 minutes)
   */

  @Cron(CronExpression.EVERY_5_MINUTES)
  performHealthCheck(): void {
    try {
      const healthReport = this.checkCacheHealth();

      if (!healthReport.healthy && this.config.enableAlerting) {
        this.handleCacheIssues(healthReport.issues);
      }

      // Log summary every 15 minutes
      const now = Date.now();
      if (now - this.lastAlertTime > 15 * 60 * 1000) {
        this.logCacheSummary(healthReport.stats);
        this.lastAlertTime = now;
      }
    } catch (error) {
      this.logger.error('Failed to perform cache health check', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleCacheIssues(issues: CacheIssue[]): void {
    const now = Date.now();
    if (now - this.lastAlertTime < this.config.alertingIntervalMs) {
      return; // Throttle alerts
    }

    const warningIssues = issues.filter((issue) => issue.severity === 'WARNING');
    const infoIssues = issues.filter((issue) => issue.severity === 'INFO');

    if (warningIssues.length > 0) {
      this.logger.warn('Cache health issues detected', { issues: warningIssues });
    }

    if (infoIssues.length > 0) {
      this.logger.log('Cache performance notices', { issues: infoIssues });
    }

    this.lastAlertTime = now;
  }

  private logCacheSummary(stats: Record<string, CacheStats & { memoryUsageBytes: number }>): void {
    const summary = Object.entries(stats).map(([name, stat]) => ({
      cache: name,
      size: stat.size,
      utilization: `${(stat.utilizationRate * 100).toFixed(1)}%`,
      hitRate: `${(stat.hitRate * 100).toFixed(1)}%`,
      memory: this.formatBytes(stat.memoryUsageBytes),
      evictions: stat.evictionCount,
    }));

    this.logger.log('Cache health summary', { caches: summary });
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}

export interface CacheHealthReport {
  timestamp: Date;
  healthy: boolean;
  issues: CacheIssue[];
  stats: Record<string, CacheStats & { memoryUsageBytes: number }>;
}

export interface CacheIssue {
  cacheName: string;
  type: 'HIGH_MEMORY_USAGE' | 'HIGH_UTILIZATION' | 'LOW_HIT_RATE';
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  value: number;
  threshold: number;
}
