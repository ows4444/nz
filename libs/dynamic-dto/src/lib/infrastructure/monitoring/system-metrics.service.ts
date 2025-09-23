import { Injectable, Logger } from '@nestjs/common';

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: MemoryMetrics;
  performance: PerformanceMetrics;
  counters: CounterMetrics;
}

export interface MemoryMetrics {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  formatted: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
    external: string;
  };
}

export interface PerformanceMetrics {
  eventLoopLag: number;
  cpuUsage: NodeJS.CpuUsage;
  loadAverage: number[];
  processUptime: number;
}

export interface CounterMetrics {
  schemaValidations: number;
  dtoGenerations: number;
  cacheHits: number;
  cacheMisses: number;
  processorCalls: number;
  validatorCalls: number;
  errors: number;
}

/**
 * Service for collecting and providing system metrics
 * Tracks performance, memory usage, and operation counters
 */
@Injectable()
export class SystemMetricsService {
  private readonly logger = new Logger(SystemMetricsService.name);
  private readonly startTime = Date.now();
  private readonly counters: CounterMetrics = {
    schemaValidations: 0,
    dtoGenerations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    processorCalls: 0,
    validatorCalls: 0,
    errors: 0,
  };

  private lastCpuUsage = process.cpuUsage();

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage();

    // Calculate CPU usage since last call
    const cpuDiff = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = currentCpuUsage;

    // Measure event loop lag (simplified)
    const _eventLoopStart = process.hrtime.bigint();
    setImmediate(() => {
      const _eventLoopEnd = process.hrtime.bigint();
      // This is a simple approximation - for production, use proper event loop monitoring
    });

    return {
      timestamp: new Date(),
      uptime: now - this.startTime,
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        formatted: {
          rss: this.formatBytes(memoryUsage.rss),
          heapUsed: this.formatBytes(memoryUsage.heapUsed),
          heapTotal: this.formatBytes(memoryUsage.heapTotal),
          external: this.formatBytes(memoryUsage.external),
        },
      },
      performance: {
        eventLoopLag: 0, // Simplified - would need proper monitoring in production
        cpuUsage: cpuDiff,
        loadAverage: process.platform === 'win32' ? [0, 0, 0] : [0, 0, 0], // Simplified for cross-platform compatibility
        processUptime: process.uptime(),
      },
      counters: { ...this.counters },
    };
  }

  /**
   * Get formatted metrics summary for logging
   */
  getMetricsSummary(): string {
    const metrics = this.getSystemMetrics();
    return (
      `Memory: ${metrics.memory.formatted.heapUsed}/${metrics.memory.formatted.heapTotal}, ` +
      `Uptime: ${Math.floor(metrics.uptime / 1000)}s, ` +
      `Operations: ${metrics.counters.dtoGenerations} DTOs, ${metrics.counters.schemaValidations} validations, ` +
      `Cache: ${metrics.counters.cacheHits}/${metrics.counters.cacheHits + metrics.counters.cacheMisses} hit ratio`
    );
  }

  // Counter increment methods
  incrementSchemaValidations(): void {
    this.counters.schemaValidations++;
  }

  incrementDtoGenerations(): void {
    this.counters.dtoGenerations++;
  }

  incrementCacheHits(): void {
    this.counters.cacheHits++;
  }

  incrementCacheMisses(): void {
    this.counters.cacheMisses++;
  }

  incrementProcessorCalls(): void {
    this.counters.processorCalls++;
  }

  incrementValidatorCalls(): void {
    this.counters.validatorCalls++;
  }

  incrementErrors(): void {
    this.counters.errors++;
  }

  /**
   * Reset all counters (useful for testing or periodic resets)
   */
  resetCounters(): void {
    Object.keys(this.counters).forEach((key) => {
      (this.counters as any)[key] = 0;
    });
    this.logger.log('System metrics counters reset');
  }

  /**
   * Get cache hit ratio as percentage
   */
  getCacheHitRatio(): number {
    const total = this.counters.cacheHits + this.counters.cacheMisses;
    return total > 0 ? (this.counters.cacheHits / total) * 100 : 0;
  }

  /**
   * Get operations per second (approximation based on uptime)
   */
  getOperationsPerSecond(): {
    dtoGenerationsPerSecond: number;
    validationsPerSecond: number;
    processorCallsPerSecond: number;
  } {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    return {
      dtoGenerationsPerSecond: uptimeSeconds > 0 ? this.counters.dtoGenerations / uptimeSeconds : 0,
      validationsPerSecond: uptimeSeconds > 0 ? this.counters.schemaValidations / uptimeSeconds : 0,
      processorCallsPerSecond: uptimeSeconds > 0 ? this.counters.processorCalls / uptimeSeconds : 0,
    };
  }

  /**
   * Check if system is under stress based on metrics
   */
  isSystemUnderStress(): boolean {
    const metrics = this.getSystemMetrics();

    // High memory usage (>80% of heap)
    const memoryStress = metrics.memory.heapUsed / metrics.memory.heapTotal > 0.8;

    // High error rate (>5% of total operations)
    const totalOps = this.counters.dtoGenerations + this.counters.schemaValidations;
    const errorStress = totalOps > 0 && this.counters.errors / totalOps > 0.05;

    // Low cache hit ratio (<50%)
    const cacheStress = this.getCacheHitRatio() < 50 && this.counters.cacheHits + this.counters.cacheMisses > 100;

    return memoryStress || errorStress || cacheStress;
  }

  /**
   * Log current metrics at INFO level
   */
  logCurrentMetrics(): void {
    const summary = this.getMetricsSummary();
    const isStressed = this.isSystemUnderStress();

    if (isStressed) {
      this.logger.warn(`System under stress - ${summary}`);
    } else {
      this.logger.log(`System metrics - ${summary}`);
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }
}
