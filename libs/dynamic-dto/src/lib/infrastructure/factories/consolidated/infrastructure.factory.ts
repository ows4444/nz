import type { Provider } from '@nestjs/common';

// Cache infrastructure
import { CacheManagerService } from '../../cache/cache-manager.service';
import { MemoryCacheStrategy } from '../../cache/strategies/memory-cache.strategy';

// Monitoring services
import { EnhancedCacheMonitorService } from '../../monitoring/enhanced-cache-monitor.service';

// Infrastructure services
import { NestedClassGeneratorService } from '../../services/nested-class-generator.service';

// Module configuration
import type { DynamicDtoModuleOptions } from '../../../interfaces/module-options.interface';

/**
 * Consolidated Infrastructure Factory
 *
 * Combines caching, monitoring, and infrastructure services into a single factory.
 * This replaces the separate infrastructure.factory.ts with a more focused approach.
 *
 * Responsibilities:
 * - Cache management strategies and services
 * - Performance monitoring services
 * - Infrastructure services (class generation, etc.)
 * - Configuration-based provider creation
 */
export function createInfrastructureProviders(options: DynamicDtoModuleOptions = {}): Provider[] {
  return [
    // === CACHE INFRASTRUCTURE ===
    ...createCacheProviders(),

    // === MONITORING SERVICES ===
    ...createMonitoringProviders(options),

    // === INFRASTRUCTURE SERVICES ===
    NestedClassGeneratorService,
  ];
}

/**
 * Creates cache-specific providers based on configuration
 *
 * This function handles cache strategy selection and configuration.
 * Supports both memory cache (default).
 */
function createCacheProviders(): Provider[] {
  // Determine cache strategy based on configuration
  const cacheStrategy = determineCacheStrategy();

  return [
    // Cache strategy configuration
    ...(cacheStrategy.configProvider ? [cacheStrategy.configProvider] : []),

    // Cache manager service
    CacheManagerService,

    // Cache manager interface implementation
    {
      provide: 'ICacheManager',
      useClass: CacheManagerService,
    },
  ];
}

/**
 * Determine cache strategy and configuration based on options
 */
function determineCacheStrategy(): {
  strategyClass: any;
  configProvider?: Provider;
} {
  return {
    strategyClass: MemoryCacheStrategy,
  };
}

/**
 * Creates monitoring providers with configuration support
 *
 * This function creates providers for cache monitoring services with
 * configurable thresholds and behavior settings.
 */
function createMonitoringProviders(options: DynamicDtoModuleOptions): Provider[] {
  return [
    // Cache monitor configuration provider
    {
      provide: 'CACHE_MONITOR_CONFIG',
      useValue: options.monitoring,
    },

    // Enhanced cache monitor service
    EnhancedCacheMonitorService,
  ];
}
