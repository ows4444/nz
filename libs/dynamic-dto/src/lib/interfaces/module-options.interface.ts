import type { ModuleMetadata } from '@nestjs/common';

export interface DynamicDtoModuleOptions {
  isGlobal?: boolean;
  imports?: ModuleMetadata['imports'];
  cache?: {
    ttl?: number;
    maxSize?: number;
  };
  validation?: {
    enableCrossFieldValidation?: boolean;
    maxNestingDepth?: number;
    performanceMode?: 'strict' | 'optimized';
  };
  monitoring?: {
    memoryThresholdBytes?: number;
    utilizationThreshold?: number;
    hitRateThreshold?: number;
    enableAutoCleanup?: boolean;
    enableAlerting?: boolean;
    alertingIntervalMs?: number;
    aggressiveCleanupThreshold?: number;
    cleanupIntervalMs?: number;
  };
}
