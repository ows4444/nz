import { Injectable, Logger } from '@nestjs/common';
import { PluginStatistics } from '../types';
import { PluginRegistryService } from './plugin-registry.service';

@Injectable()
export class PluginStatisticsService {
  private readonly logger = new Logger(PluginStatisticsService.name);
  private readonly startTime = Date.now();

  constructor(private readonly pluginRegistry: PluginRegistryService) {}

  /**
   * Get comprehensive plugin statistics
   */
  getStatistics(): PluginStatistics {
    const plugins = this.pluginRegistry.getAll();

    const statistics: PluginStatistics = {
      totalRegistered: plugins.length,
      activePlugins: plugins.filter((p) => p.status === 'active').length,
      inactivePlugins: plugins.filter((p) => p.status === 'inactive').length,
      errorPlugins: plugins.filter((p) => p.status === 'error').length,
      pluginNames: plugins.map((p) => p.name),
      loadTime: plugins.reduce((total, p) => total + (p.metrics?.loadTime || 0), 0),
      memoryUsage: plugins.reduce((total, p) => total + (p.metrics?.memoryUsage || 0), 0),
    };

    this.logger.debug('Generated plugin statistics', statistics);
    return statistics;
  }

  /**
   * Get statistics for a specific plugin
   */
  getPluginStatistics(pluginName: string): Partial<PluginStatistics> | null {
    const plugin = this.pluginRegistry.get(pluginName);
    if (!plugin) {
      return null;
    }

    return {
      totalRegistered: 1,
      activePlugins: plugin.status === 'active' ? 1 : 0,
      inactivePlugins: plugin.status === 'inactive' ? 1 : 0,
      errorPlugins: plugin.status === 'error' ? 1 : 0,
      pluginNames: [plugin.name],
      loadTime: plugin.metrics?.loadTime || 0,
      memoryUsage: plugin.metrics?.memoryUsage || 0,
    };
  }

  /**
   * Get performance metrics for all plugins
   */
  getPerformanceMetrics(): {
    totalLoadTime: number;
    averageLoadTime: number;
    totalMemoryUsage: number;
    averageMemoryUsage: number;
    totalRequestCount: number;
    averageRequestCount: number;
    uptime: number;
  } {
    const plugins = this.pluginRegistry.getAll();
    const totalPlugins = plugins.length;

    if (totalPlugins === 0) {
      return {
        totalLoadTime: 0,
        averageLoadTime: 0,
        totalMemoryUsage: 0,
        averageMemoryUsage: 0,
        totalRequestCount: 0,
        averageRequestCount: 0,
        uptime: Date.now() - this.startTime,
      };
    }

    const totalLoadTime = plugins.reduce((total, p) => total + (p.metrics?.loadTime || 0), 0);
    const totalMemoryUsage = plugins.reduce((total, p) => total + (p.metrics?.memoryUsage || 0), 0);
    const totalRequestCount = plugins.reduce((total, p) => total + (p.metrics?.requestCount || 0), 0);

    return {
      totalLoadTime,
      averageLoadTime: totalLoadTime / totalPlugins,
      totalMemoryUsage,
      averageMemoryUsage: totalMemoryUsage / totalPlugins,
      totalRequestCount,
      averageRequestCount: totalRequestCount / totalPlugins,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get plugin health summary
   */
  getHealthSummary(): {
    healthy: number;
    unhealthy: number;
    unknown: number;
    healthPercentage: number;
  } {
    const plugins = this.pluginRegistry.getAll();
    const totalPlugins = plugins.length;

    if (totalPlugins === 0) {
      return {
        healthy: 0,
        unhealthy: 0,
        unknown: 0,
        healthPercentage: 100,
      };
    }

    const healthy = plugins.filter((p) => p.status === 'active').length;
    const unhealthy = plugins.filter((p) => p.status === 'error').length;
    const unknown = plugins.filter((p) => p.status === 'inactive').length;

    return {
      healthy,
      unhealthy,
      unknown,
      healthPercentage: (healthy / totalPlugins) * 100,
    };
  }

  /**
   * Get plugins sorted by activity
   */
  getMostActivePlugins(limit = 10): Array<{
    name: string;
    requestCount: number;
    lastActivity?: Date;
  }> {
    return this.pluginRegistry
      .getAll()
      .filter((plugin) => plugin.metrics?.requestCount)
      .sort((a, b) => (b.metrics?.requestCount || 0) - (a.metrics?.requestCount || 0))
      .slice(0, limit)
      .map((plugin) => ({
        name: plugin.name,
        requestCount: plugin.metrics?.requestCount || 0,
        lastActivity: plugin.lastActivity,
      }));
  }

  /**
   * Get plugins with highest memory usage
   */
  getHighMemoryPlugins(limit = 10): Array<{
    name: string;
    memoryUsage: number;
    status: string;
  }> {
    return this.pluginRegistry
      .getAll()
      .filter((plugin) => plugin.metrics?.memoryUsage)
      .sort((a, b) => (b.metrics?.memoryUsage || 0) - (a.metrics?.memoryUsage || 0))
      .slice(0, limit)
      .map((plugin) => ({
        name: plugin.name,
        memoryUsage: plugin.metrics?.memoryUsage || 0,
        status: plugin.status,
      }));
  }
}
