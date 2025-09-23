import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { CacheMemoryInfo, ICacheManager } from '../../core/interfaces/cache/cache-manager.interface';
import type { CacheMetrics } from '../../core/interfaces/cache/cache-metrics.interface';

export interface EnhancedCacheMonitorConfig {
  readonly memoryThresholdBytes?: number;
  readonly utilizationThreshold?: number;
  readonly hitRateThreshold?: number;
  readonly enableAutoCleanup?: boolean;
  readonly enableAlerting?: boolean;
  readonly alertingIntervalMs?: number;
  readonly aggressiveCleanupThreshold?: number;
}

export interface CacheHealthMetrics {
  timestamp: Date;
  memoryUsage: CacheMemoryInfo;
  thresholdExceeded: boolean;
  recommendations: CacheRecommendation[];
}

export interface CacheRecommendation {
  type: 'CLEANUP_EXPIRED' | 'AGGRESSIVE_CLEANUP' | 'INCREASE_THRESHOLD' | 'OPTIMIZE_TTL';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  action?: () => Promise<void>;
}

@Injectable()
export class EnhancedCacheMonitorService implements OnModuleDestroy {
  private readonly logger = new Logger(EnhancedCacheMonitorService.name);
  private readonly config: Required<EnhancedCacheMonitorConfig>;
  private lastAlertTime = 0;
  private lastCleanupTime = 0;

  // Memory management to prevent circular references
  private cacheManagerRef: ICacheManager | null;
  private isDestroyed = false;

  // Store cleanup actions to prevent memory leaks
  private readonly cleanupActions = new Set<() => Promise<void>>();

  // State tracking for compatibility with test expectations
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0,
    peakMemoryUsage: 0,
    cacheSize: 0,
    currentSize: 0,
    lastHit: 0,
    lastMiss: 0,
    lastEviction: 0,
    lastMemoryUpdate: 0,
    startTime: Date.now(),
  };

  constructor(
    @Inject('ICacheManager') cacheManager: ICacheManager,
    @Inject('CACHE_MONITOR_CONFIG')
    private readonly userConfig?: Partial<EnhancedCacheMonitorConfig>
  ) {
    // Store reference for controlled cleanup
    this.cacheManagerRef = cacheManager;
    // Merge user configuration with defaults
    this.config = {
      memoryThresholdBytes: userConfig?.memoryThresholdBytes ?? (parseInt(process.env.CACHE_MEMORY_THRESHOLD_BYTES ?? '0') || 50 * 1024 * 1024), // 50MB default or env
      utilizationThreshold: userConfig?.utilizationThreshold ?? (parseFloat(process.env.CACHE_UTILIZATION_THRESHOLD ?? '0') || 0.85), // 85% default or env
      hitRateThreshold: userConfig?.hitRateThreshold ?? (parseFloat(process.env.CACHE_HIT_RATE_THRESHOLD ?? '0') || 0.7), // 70% default or env
      enableAutoCleanup: userConfig?.enableAutoCleanup ?? process.env.CACHE_ENABLE_AUTO_CLEANUP !== 'false', // true default unless env is 'false'
      enableAlerting: userConfig?.enableAlerting ?? process.env.CACHE_ENABLE_ALERTING !== 'false', // true default unless env is 'false'
      alertingIntervalMs: userConfig?.alertingIntervalMs ?? (parseInt(process.env.CACHE_ALERTING_INTERVAL_MS ?? '0') || 5 * 60 * 1000), // 5 minutes default or env
      aggressiveCleanupThreshold: userConfig?.aggressiveCleanupThreshold ?? (parseFloat(process.env.CACHE_AGGRESSIVE_CLEANUP_THRESHOLD ?? '0') || 0.95), // 95% default or env
    };

    this.logger.log('Enhanced cache monitoring initialized', {
      memoryThreshold: this.formatBytes(this.config.memoryThresholdBytes),
      utilizationThreshold: `${(this.config.utilizationThreshold * 100).toFixed(1)}%`,
      autoCleanup: this.config.enableAutoCleanup,
    });
  }

  /**
   * Cleanup method to prevent memory leaks
   */
  onModuleDestroy(): void {
    this.isDestroyed = true;

    // Clear all cleanup actions
    this.cleanupActions.clear();

    // Clear the cache manager reference to prevent memory leaks
    this.cacheManagerRef = null;

    this.logger.log('Enhanced cache monitoring service destroyed - cleanup completed');
  }

  /**
   * Get cache manager with safety check for destroyed service
   */
  private getCacheManager(): ICacheManager | null {
    if (this.isDestroyed || !this.cacheManagerRef) {
      return null;
    }

    return this.cacheManagerRef;
  }

  /**
   * Record a cache hit for monitoring purposes
   */
  recordCacheHit(key: string | null): void {
    if (this.isDestroyed || !key) {
      return;
    }

    // Track metrics for compatibility
    this.metrics.hits++;
    this.metrics.lastHit = Date.now();

    // For EnhancedCacheMonitorService, cache hits are tracked by the underlying cache manager
    // This method provides compatibility with the CacheMonitorService interface
    const cacheManager = this.getCacheManager();
    if (cacheManager) {
      // Cache hits are automatically tracked by the cache manager
      this.logger.debug(`Cache hit recorded for key: ${key}`);
    }
  }

  /**
   * Record a cache miss for monitoring purposes
   */
  recordCacheMiss(key: string | null): void {
    if (this.isDestroyed || !key) {
      return;
    }

    // Track metrics for compatibility
    this.metrics.misses++;
    this.metrics.lastMiss = Date.now();

    // For EnhancedCacheMonitorService, cache misses are tracked by the underlying cache manager
    // This method provides compatibility with the CacheMonitorService interface
    const cacheManager = this.getCacheManager();
    if (cacheManager) {
      // Cache misses are automatically tracked by the cache manager
      this.logger.debug(`Cache miss recorded for key: ${key}`);
    }
  }

  /**
   * Record a cache eviction for monitoring purposes
   */
  recordCacheEviction(key: string | null, reason: string): void {
    if (this.isDestroyed || !key) {
      return;
    }

    // Track metrics for compatibility
    this.metrics.evictions++;
    this.metrics.lastEviction = Date.now();

    // For EnhancedCacheMonitorService, cache evictions are tracked by the underlying cache manager
    // This method provides compatibility with the CacheMonitorService interface
    const cacheManager = this.getCacheManager();
    if (cacheManager) {
      // Cache evictions are automatically tracked by the cache manager
      this.logger.debug(`Cache eviction recorded for key: ${key}, reason: ${reason}`);
    }
  }

  /**
   * Get cache metrics (compatibility method)
   */
  getMetrics(): CacheMetrics {
    if (this.isDestroyed) {
      return {
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0,
        hitRatio: 0,
        memoryUsage: 0,
        peakMemoryUsage: 0,
        cacheSize: 0,
        currentSize: 0,
        maxSize: 0,
        lastAccess: null,
        lastHit: 0,
        lastMiss: 0,
        lastEviction: 0,
        lastMemoryUpdate: 0,
        startTime: 0,
        uptime: 0,
      };
    }

    const now = Date.now();
    const totalOperations = this.metrics.hits + this.metrics.misses;
    const hitRate = totalOperations > 0 ? this.metrics.hits / totalOperations : 0;
    const uptime = now - this.metrics.startTime;

    // Return actual tracked metrics
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      hitRate,
      hitRatio: hitRate, // Same as hitRate for compatibility
      memoryUsage: this.metrics.memoryUsage,
      peakMemoryUsage: this.metrics.peakMemoryUsage,
      cacheSize: this.metrics.cacheSize,
      currentSize: this.metrics.currentSize,
      maxSize: 1000, // Default max size
      lastAccess: this.metrics.lastHit > 0 ? new Date(Math.max(this.metrics.lastHit, this.metrics.lastMiss)) : null,
      lastHit: this.metrics.lastHit,
      lastMiss: this.metrics.lastMiss,
      lastEviction: this.metrics.lastEviction,
      lastMemoryUpdate: this.metrics.lastMemoryUpdate,
      startTime: this.metrics.startTime,
      uptime,
    };
  }

  /**
   * Update memory usage (compatibility method)
   */
  updateMemoryUsage(bytes: number): void {
    if (this.isDestroyed) {
      return;
    }

    // Track metrics for compatibility
    this.metrics.memoryUsage = bytes;
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, bytes);
    this.metrics.lastMemoryUpdate = Date.now();

    // This is a compatibility method - actual memory tracking is done by the cache manager
    this.logger.debug(`Memory usage updated: ${this.formatBytes(bytes)}`);
  }

  /**
   * Update cache size (compatibility method)
   */
  updateCacheSize(size: number): void {
    if (this.isDestroyed) {
      return;
    }

    // Track metrics for compatibility
    this.metrics.currentSize = size;
    this.metrics.cacheSize = size; // Same as currentSize for compatibility

    // This is a compatibility method - actual size tracking is done by the cache manager
    this.logger.debug(`Cache size updated: ${size} entries`);
  }

  /**
   * Reset metrics (compatibility method)
   */
  reset(): void {
    if (this.isDestroyed) {
      return;
    }

    // Reset all tracked metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      cacheSize: 0,
      currentSize: 0,
      lastHit: 0,
      lastMiss: 0,
      lastEviction: 0,
      lastMemoryUpdate: 0,
      startTime: Date.now(),
    };

    this.logger.debug('Metrics reset completed');
  }

  /**
   * Get detailed report (compatibility method)
   */
  getDetailedReport(): any {
    if (this.isDestroyed) {
      return {
        summary: 'Cache monitor service has been destroyed',
        metrics: this.getMetrics(),
        performance: {
          efficiency: 0,
          memoryEfficiency: 0,
          recommendations: [],
        },
        trends: [],
        recommendations: [],
      };
    }

    const metrics = this.getMetrics();
    const hitRate = metrics.hitRate;
    const memoryEfficiency = metrics.peakMemoryUsage > 0 ? 1 - metrics.memoryUsage / metrics.peakMemoryUsage : 1;

    return {
      summary: 'Enhanced cache monitor report',
      metrics,
      performance: {
        efficiency: hitRate,
        memoryEfficiency,
        recommendations: hitRate < 0.7 ? ['Consider optimizing cache keys', 'Review TTL settings'] : [],
      },
      trends: [{ timestamp: new Date(), hitRate, memoryUsage: metrics.memoryUsage }],
      recommendations: [],
      config: this.config,
      isDestroyed: this.isDestroyed,
    };
  }

  /**
   * Get current cache health metrics and recommendations
   */
  async getCacheHealthMetrics(): Promise<CacheHealthMetrics | null> {
    const cacheManager = this.getCacheManager();
    if (!cacheManager) {
      return null;
    }

    const memoryUsage = await cacheManager.getMemoryUsage();
    const thresholdExceeded = await cacheManager.isMemoryThresholdExceeded();
    const recommendations = this.generateRecommendations(memoryUsage, thresholdExceeded);

    return {
      timestamp: new Date(),
      memoryUsage,
      thresholdExceeded,
      recommendations,
    };
  }

  /**
   * Force cache cleanup with optional aggressive mode
   */
  async forceCleanup(aggressive = false): Promise<void> {
    const cacheManager = this.getCacheManager();
    if (!cacheManager) {
      this.logger.warn('Cannot perform cleanup - cache manager unavailable');
      return;
    }

    try {
      const result = await cacheManager.cleanup(aggressive);
      this.lastCleanupTime = Date.now();

      this.logger.log(`Manual cache cleanup completed: ${result.entriesRemoved} entries removed, ` + `${this.formatBytes(result.memoryFreed)} freed in ${result.duration}ms`);
    } catch (error) {
      this.logger.error('Manual cache cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        aggressive,
      });
    }
  }

  /**
   * Periodic cache health monitoring (runs every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthCheck(): Promise<void> {
    if (this.isDestroyed) {
      return; // Skip execution if service is destroyed
    }

    try {
      const metrics = await this.getCacheHealthMetrics();
      if (!metrics) {
        return; // Skip if cache manager unavailable
      }

      // Handle automatic cleanup if enabled
      if (this.config.enableAutoCleanup && this.shouldPerformCleanup(metrics)) {
        await this.performAutomaticCleanup(metrics);
      }

      // Handle alerting
      if (this.config.enableAlerting && this.shouldAlert(metrics)) {
        this.handleHealthAlerts(metrics);
      }

      // Log periodic summary every 10 minutes
      const now = Date.now();
      if (now - this.lastAlertTime > 10 * 60 * 1000) {
        this.logHealthSummary(metrics);
        this.lastAlertTime = now;
      }
    } catch (error) {
      this.logger.error('Cache health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private generateRecommendations(memoryUsage: CacheMemoryInfo, thresholdExceeded: boolean): CacheRecommendation[] {
    const recommendations: CacheRecommendation[] = [];

    // Memory threshold recommendations
    if (thresholdExceeded) {
      if (memoryUsage.utilizationRate > this.config.aggressiveCleanupThreshold) {
        // Create cleanup action to prevent memory leaks
        const cleanupAction = async (): Promise<void> => {
          const cacheManager = this.getCacheManager();
          if (cacheManager) {
            await cacheManager.cleanup(true);
          }
        };

        this.cleanupActions.add(cleanupAction);

        recommendations.push({
          type: 'AGGRESSIVE_CLEANUP',
          severity: 'CRITICAL',
          message: `Critical memory usage (${this.formatBytes(memoryUsage.estimatedBytes)}). Aggressive cleanup recommended.`,
          action: cleanupAction,
        });
      } else {
        // Create cleanup action to prevent memory leaks
        const cleanupAction = async (): Promise<void> => {
          const cacheManager = this.getCacheManager();
          if (cacheManager) {
            await cacheManager.cleanup(false);
          }
        };

        this.cleanupActions.add(cleanupAction);

        recommendations.push({
          type: 'CLEANUP_EXPIRED',
          severity: 'WARNING',
          message: `Memory threshold exceeded (${this.formatBytes(memoryUsage.estimatedBytes)}). Basic cleanup recommended.`,
          action: cleanupAction,
        });
      }
    }

    // Hit rate recommendations
    if (memoryUsage.hitRate < this.config.hitRateThreshold && memoryUsage.entryCount > 10) {
      recommendations.push({
        type: 'OPTIMIZE_TTL',
        severity: 'INFO',
        message: `Low cache hit rate (${(memoryUsage.hitRate * 100).toFixed(1)}%). Consider optimizing TTL values.`,
      });
    }

    // Utilization recommendations
    if (memoryUsage.utilizationRate > this.config.utilizationThreshold) {
      recommendations.push({
        type: 'INCREASE_THRESHOLD',
        severity: 'WARNING',
        message: `High cache utilization (${(memoryUsage.utilizationRate * 100).toFixed(1)}%). Consider increasing memory threshold.`,
      });
    }

    return recommendations;
  }

  private shouldPerformCleanup(metrics: CacheHealthMetrics): boolean {
    // Don't cleanup too frequently
    const timeSinceLastCleanup = Date.now() - this.lastCleanupTime;
    if (timeSinceLastCleanup < 60 * 1000) {
      // Wait at least 1 minute
      return false;
    }

    // Cleanup if threshold exceeded or utilization is high
    return metrics.thresholdExceeded || metrics.memoryUsage.utilizationRate > this.config.utilizationThreshold;
  }

  private async performAutomaticCleanup(metrics: CacheHealthMetrics): Promise<void> {
    const cacheManager = this.getCacheManager();
    if (!cacheManager) {
      return;
    }

    try {
      const aggressiveMode = metrics.memoryUsage.utilizationRate > this.config.aggressiveCleanupThreshold;

      this.logger.log(`Performing automatic cache cleanup ${aggressiveMode ? '(aggressive)' : '(normal)'}`);

      await cacheManager.cleanup(aggressiveMode);
      this.lastCleanupTime = Date.now();
    } catch (error) {
      this.logger.error('Automatic cache cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private shouldAlert(metrics: CacheHealthMetrics): boolean {
    const now = Date.now();
    if (now - this.lastAlertTime < this.config.alertingIntervalMs) {
      return false; // Throttle alerts
    }

    // Alert on critical or warning recommendations
    return metrics.recommendations.some((rec) => rec.severity === 'CRITICAL' || rec.severity === 'WARNING');
  }

  private handleHealthAlerts(metrics: CacheHealthMetrics): void {
    const criticalRecs = metrics.recommendations.filter((rec) => rec.severity === 'CRITICAL');
    const warningRecs = metrics.recommendations.filter((rec) => rec.severity === 'WARNING');

    if (criticalRecs.length > 0) {
      this.logger.error('Critical cache health issues detected', {
        issues: criticalRecs.map((rec) => rec.message),
        memoryUsage: this.formatBytes(metrics.memoryUsage.estimatedBytes),
        utilizationRate: `${(metrics.memoryUsage.utilizationRate * 100).toFixed(1)}%`,
      });
    }

    if (warningRecs.length > 0) {
      this.logger.warn('Cache health warnings detected', {
        issues: warningRecs.map((rec) => rec.message),
        memoryUsage: this.formatBytes(metrics.memoryUsage.estimatedBytes),
        hitRate: `${(metrics.memoryUsage.hitRate * 100).toFixed(1)}%`,
      });
    }

    this.lastAlertTime = Date.now();
  }

  private logHealthSummary(metrics: CacheHealthMetrics): void {
    const summary = {
      timestamp: metrics.timestamp.toISOString(),
      memoryUsage: this.formatBytes(metrics.memoryUsage.estimatedBytes),
      entryCount: metrics.memoryUsage.entryCount,
      utilizationRate: `${(metrics.memoryUsage.utilizationRate * 100).toFixed(1)}%`,
      hitRate: `${(metrics.memoryUsage.hitRate * 100).toFixed(1)}%`,
      thresholdExceeded: metrics.thresholdExceeded,
      recommendationCount: metrics.recommendations.length,
      lastCleanup: metrics.memoryUsage.lastCleanup?.toISOString() ?? 'Never',
    };

    this.logger.log('Cache health summary', summary);
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}
