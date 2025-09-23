import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheMonitorService } from './cache-monitor.service';
import { EnhancedCacheMonitorService } from './enhanced-cache-monitor.service';
import { SystemMetricsService } from './system-metrics.service';
import { PerformanceMetricsService } from './performance-metrics.service';
import { CacheModule } from '../../modules/cache.module';

/**
 * Monitoring module providing health checks and system metrics
 * Includes cache monitoring, registry health, and HTTP endpoints
 */
@Module({
  imports: [
    ScheduleModule.forRoot({}), // Enable scheduled tasks for periodic monitoring
    CacheModule, // Import cache module to access ICacheManager
  ],

  providers: [
    // Cache monitor configuration provider
    {
      provide: 'CACHE_MONITOR_CONFIG',
      useValue: {},
    },

    // Cache monitor service with configuration
    {
      provide: CacheMonitorService,
      useFactory: () => new CacheMonitorService({}),
    },

    EnhancedCacheMonitorService, // Advanced cache monitoring with metrics
    SystemMetricsService, // System-wide metrics and counters
    PerformanceMetricsService, // Detailed performance metrics and analysis
  ],
  exports: [CacheMonitorService, EnhancedCacheMonitorService, SystemMetricsService, PerformanceMetricsService],
})
export class MonitoringModule {}
