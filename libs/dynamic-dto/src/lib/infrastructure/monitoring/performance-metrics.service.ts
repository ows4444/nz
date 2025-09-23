import { Injectable, Logger } from '@nestjs/common';

export interface ProcessingTimeMetrics {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly p95: number;
  readonly p99: number;
  readonly count: number;
}

export interface SchemaComplexityMetrics {
  readonly fieldCount: number;
  readonly nestingDepth: number;
  readonly circularReferences: number;
  readonly unionTypes: number;
  readonly arrayFields: number;
  readonly objectFields: number;
  readonly complexityScore: number;
}

export interface ValidationMetrics {
  readonly totalValidations: number;
  readonly failureRate: number;
  readonly successRate: number;
  readonly avgErrorsPerValidation: number;
  readonly mostCommonErrors: { error: string; count: number }[];
}

export interface CacheEfficiencyMetrics {
  readonly hitRate: number;
  readonly missRate: number;
  readonly evictionRate: number;
  readonly avgLookupTime: number;
  readonly memoryUtilization: number;
  readonly totalOperations: number;
}

export interface PerformanceSnapshot {
  readonly timestamp: Date;
  readonly processingTimes: {
    readonly schemaValidation: ProcessingTimeMetrics;
    readonly dtoGeneration: ProcessingTimeMetrics;
    readonly fieldProcessing: ProcessingTimeMetrics;
    readonly cacheOperations: ProcessingTimeMetrics;
  };
  readonly schemaComplexity: SchemaComplexityMetrics;
  readonly validation: ValidationMetrics;
  readonly cacheEfficiency: CacheEfficiencyMetrics;
}

/**
 * Enhanced performance metrics collection and analysis service
 * Provides detailed performance insights for production monitoring
 */
@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);

  // Processing time buckets (in milliseconds)
  private readonly processingTimes = {
    schemaValidation: [] as number[],
    dtoGeneration: [] as number[],
    fieldProcessing: [] as number[],
    cacheOperations: [] as number[],
  };

  // Error tracking
  private readonly errorCounts = new Map<string, number>();
  private totalValidations = 0;
  private failedValidations = 0;

  // Schema complexity tracking
  private readonly schemaComplexities: SchemaComplexityMetrics[] = [];

  // Cache metrics
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private readonly cacheLookupTimes: number[] = [];

  /**
   * Record processing time for a specific operation
   */
  recordProcessingTime(operation: keyof typeof this.processingTimes, duration: number): void {
    const times = this.processingTimes[operation];
    times.push(duration);

    // Keep only last 1000 measurements to prevent memory growth
    if (times.length > 1000) {
      times.shift();
    }
  }

  /**
   * Record validation result
   */
  recordValidation(success: boolean, errors: string[] = []): void {
    this.totalValidations++;

    if (!success) {
      this.failedValidations++;

      // Track error types
      errors.forEach((error) => {
        this.errorCounts.set(error, (this.errorCounts.get(error) ?? 0) + 1);
      });
    }
  }

  /**
   * Record schema complexity metrics
   */
  recordSchemaComplexity(metrics: SchemaComplexityMetrics): void {
    this.schemaComplexities.push(metrics);

    // Keep only last 100 schema complexity records
    if (this.schemaComplexities.length > 100) {
      this.schemaComplexities.shift();
    }
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(type: 'hit' | 'miss' | 'eviction', lookupTime?: number): void {
    switch (type) {
      case 'hit':
        this.cacheHits++;
        break;
      case 'miss':
        this.cacheMisses++;
        break;
      case 'eviction':
        this.cacheEvictions++;
        break;
    }

    if (lookupTime !== undefined) {
      this.cacheLookupTimes.push(lookupTime);

      // Keep only last 500 lookup times
      if (this.cacheLookupTimes.length > 500) {
        this.cacheLookupTimes.shift();
      }
    }
  }

  /**
   * Calculate processing time metrics from recorded durations
   */
  private calculateProcessingTimeMetrics(times: number[]): ProcessingTimeMetrics {
    if (times.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        count: 0,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;

    const min = sorted[0] ?? 0;
    const max = sorted[count - 1] ?? 0;
    const mean = times.reduce((sum, time) => sum + time, 0) / count;
    const median = count % 2 === 0 ? ((sorted[Math.floor(count / 2) - 1] ?? 0) + (sorted[Math.floor(count / 2)] ?? 0)) / 2 : sorted[Math.floor(count / 2)] ?? 0;

    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      min,
      max,
      mean,
      median,
      p95: sorted[p95Index] ?? max,
      p99: sorted[p99Index] ?? max,
      count,
    };
  }

  /**
   * Calculate average schema complexity
   */
  private calculateSchemaComplexity(): SchemaComplexityMetrics {
    if (this.schemaComplexities.length === 0) {
      return {
        fieldCount: 0,
        nestingDepth: 0,
        circularReferences: 0,
        unionTypes: 0,
        arrayFields: 0,
        objectFields: 0,
        complexityScore: 0,
      };
    }

    const count = this.schemaComplexities.length;
    const totals = this.schemaComplexities.reduce(
      (acc, metrics) => ({
        fieldCount: acc.fieldCount + metrics.fieldCount,
        nestingDepth: acc.nestingDepth + metrics.nestingDepth,
        circularReferences: acc.circularReferences + metrics.circularReferences,
        unionTypes: acc.unionTypes + metrics.unionTypes,
        arrayFields: acc.arrayFields + metrics.arrayFields,
        objectFields: acc.objectFields + metrics.objectFields,
        complexityScore: acc.complexityScore + metrics.complexityScore,
      }),
      {
        fieldCount: 0,
        nestingDepth: 0,
        circularReferences: 0,
        unionTypes: 0,
        arrayFields: 0,
        objectFields: 0,
        complexityScore: 0,
      }
    );

    return {
      fieldCount: Math.round(totals.fieldCount / count),
      nestingDepth: Math.round(totals.nestingDepth / count),
      circularReferences: Math.round(totals.circularReferences / count),
      unionTypes: Math.round(totals.unionTypes / count),
      arrayFields: Math.round(totals.arrayFields / count),
      objectFields: Math.round(totals.objectFields / count),
      complexityScore: Math.round(totals.complexityScore / count),
    };
  }

  /**
   * Get current performance snapshot
   */
  getPerformanceSnapshot(): PerformanceSnapshot {
    const totalCacheOps = this.cacheHits + this.cacheMisses;
    const avgCacheLookupTime = this.cacheLookupTimes.length > 0 ? this.cacheLookupTimes.reduce((sum, time) => sum + time, 0) / this.cacheLookupTimes.length : 0;

    // Calculate most common errors
    const sortedErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    return {
      timestamp: new Date(),
      processingTimes: {
        schemaValidation: this.calculateProcessingTimeMetrics(this.processingTimes.schemaValidation),
        dtoGeneration: this.calculateProcessingTimeMetrics(this.processingTimes.dtoGeneration),
        fieldProcessing: this.calculateProcessingTimeMetrics(this.processingTimes.fieldProcessing),
        cacheOperations: this.calculateProcessingTimeMetrics(this.processingTimes.cacheOperations),
      },
      schemaComplexity: this.calculateSchemaComplexity(),
      validation: {
        totalValidations: this.totalValidations,
        failureRate: this.totalValidations > 0 ? this.failedValidations / this.totalValidations : 0,
        successRate: this.totalValidations > 0 ? (this.totalValidations - this.failedValidations) / this.totalValidations : 0,
        avgErrorsPerValidation: this.totalValidations > 0 ? Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0) / this.totalValidations : 0,
        mostCommonErrors: sortedErrors,
      },
      cacheEfficiency: {
        hitRate: totalCacheOps > 0 ? this.cacheHits / totalCacheOps : 0,
        missRate: totalCacheOps > 0 ? this.cacheMisses / totalCacheOps : 0,
        evictionRate: totalCacheOps > 0 ? this.cacheEvictions / totalCacheOps : 0,
        avgLookupTime: avgCacheLookupTime,
        memoryUtilization: 0, // This would need to be calculated based on actual cache implementation
        totalOperations: totalCacheOps,
      },
    };
  }

  /**
   * Get performance summary for logging
   */
  getPerformanceSummary(): string {
    const snapshot = this.getPerformanceSnapshot();

    return [
      `Processing: Schema(${snapshot.processingTimes.schemaValidation.mean.toFixed(2)}ms avg)`,
      `DTO(${snapshot.processingTimes.dtoGeneration.mean.toFixed(2)}ms avg)`,
      `Validation: ${(snapshot.validation.successRate * 100).toFixed(1)}% success rate`,
      `Cache: ${(snapshot.cacheEfficiency.hitRate * 100).toFixed(1)}% hit rate`,
      `Complexity: ${snapshot.schemaComplexity.complexityScore} avg score`,
    ].join(', ');
  }

  /**
   * Reset all metrics (useful for testing or periodic resets)
   */
  resetMetrics(): void {
    Object.keys(this.processingTimes).forEach((key) => {
      this.processingTimes[key as keyof typeof this.processingTimes] = [];
    });

    this.errorCounts.clear();
    this.totalValidations = 0;
    this.failedValidations = 0;
    this.schemaComplexities.length = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.cacheLookupTimes.length = 0;

    this.logger.log('Performance metrics reset');
  }

  /**
   * Check if system is experiencing performance issues
   */
  isPerformanceDegraded(): boolean {
    const snapshot = this.getPerformanceSnapshot();

    // High average processing times (>100ms)
    const highProcessingTime = snapshot.processingTimes.schemaValidation.mean > 100 || snapshot.processingTimes.dtoGeneration.mean > 100;

    // High failure rate (>10%)
    const highFailureRate = snapshot.validation.failureRate > 0.1;

    // Low cache hit rate (<70%)
    const lowCacheHitRate = snapshot.cacheEfficiency.hitRate < 0.7 && snapshot.cacheEfficiency.totalOperations > 50;

    // High complexity (>50 score)
    const highComplexity = snapshot.schemaComplexity.complexityScore > 50;

    return highProcessingTime || highFailureRate || lowCacheHitRate || highComplexity;
  }

  /**
   * Log performance metrics at INFO level
   */
  logPerformanceMetrics(): void {
    const summary = this.getPerformanceSummary();
    const isDegraded = this.isPerformanceDegraded();

    if (isDegraded) {
      this.logger.warn(`Performance degraded - ${summary}`);
    } else {
      this.logger.log(`Performance metrics - ${summary}`);
    }
  }
}
