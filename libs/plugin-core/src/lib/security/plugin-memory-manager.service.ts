import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PluginMemoryManagerService {
  private readonly logger = new Logger(PluginMemoryManagerService.name);
  private readonly pluginMemoryUsage = new Map<string, MemoryStats>();
  private readonly memoryLimits = new Map<string, number>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMemoryStats();
    }, 5000); // Check every 5 seconds

    this.logger.log('Started memory monitoring');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.log('Stopped memory monitoring');
    }
  }

  setMemoryLimit(pluginId: string, limitBytes: number): void {
    this.memoryLimits.set(pluginId, limitBytes);
    this.logger.log(`Set memory limit for plugin ${pluginId}: ${this.formatBytes(limitBytes)}`);
  }

  getMemoryUsage(pluginId: string): MemoryStats | undefined {
    return this.pluginMemoryUsage.get(pluginId);
  }

  getAllMemoryUsage(): Map<string, MemoryStats> {
    return new Map(this.pluginMemoryUsage);
  }

  checkMemoryLimit(pluginId: string): boolean {
    const usage = this.pluginMemoryUsage.get(pluginId);
    const limit = this.memoryLimits.get(pluginId);

    if (!usage || !limit) {
      return true; // No limit or no usage data
    }

    const exceeded = usage.heapUsed > limit;
    if (exceeded) {
      this.logger.warn(`Plugin ${pluginId} exceeded memory limit: ${this.formatBytes(usage.heapUsed)} > ${this.formatBytes(limit)}`);
    }

    return !exceeded;
  }

  forceGarbageCollection(pluginId: string): void {
    if (global.gc) {
      this.logger.log(`Forcing garbage collection for plugin ${pluginId}`);
      global.gc();
      
      // Update stats after GC
      setTimeout(() => {
        this.collectMemoryStatsForPlugin(pluginId);
      }, 100);
    } else {
      this.logger.warn('Garbage collection not available (run with --expose-gc)');
    }
  }

  generateMemoryReport(): MemoryReport {
    const totalStats = process.memoryUsage();
    const pluginStats = Array.from(this.pluginMemoryUsage.entries()).map(([pluginId, stats]) => ({
      pluginId,
      stats,
      limit: this.memoryLimits.get(pluginId)
    }));

    const totalPluginMemory = pluginStats.reduce((sum, plugin) => sum + plugin.stats.heapUsed, 0);

    return {
      timestamp: new Date(),
      system: totalStats,
      totalPluginMemory,
      plugins: pluginStats,
      memoryPressure: this.calculateMemoryPressure()
    };
  }

  cleanupPluginMemory(pluginId: string): void {
    this.pluginMemoryUsage.delete(pluginId);
    this.memoryLimits.delete(pluginId);
    this.logger.log(`Cleaned up memory tracking for plugin ${pluginId}`);
  }

  private collectMemoryStats(): void {
    for (const pluginId of this.memoryLimits.keys()) {
      this.collectMemoryStatsForPlugin(pluginId);
    }
  }

  private collectMemoryStatsForPlugin(pluginId: string): void {
    try {
      // In a real implementation, this would collect actual plugin-specific memory usage
      // For now, we'll simulate with process memory usage
      const memoryUsage = process.memoryUsage();
      
      const stats: MemoryStats = {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        timestamp: new Date()
      };

      this.pluginMemoryUsage.set(pluginId, stats);

      // Check if limit exceeded
      if (!this.checkMemoryLimit(pluginId)) {
        this.handleMemoryLimitExceeded(pluginId);
      }
    } catch (error) {
      this.logger.error(`Failed to collect memory stats for plugin ${pluginId}`, error);
    }
  }

  private handleMemoryLimitExceeded(pluginId: string): void {
    this.logger.error(`Plugin ${pluginId} exceeded memory limit`);
    
    // First try garbage collection
    this.forceGarbageCollection(pluginId);
    
    // If still exceeded after a delay, we might need to restart the plugin
    setTimeout(() => {
      if (!this.checkMemoryLimit(pluginId)) {
        this.logger.error(`Plugin ${pluginId} still exceeding memory limit after GC`);
        // Here you would typically emit an event to restart the plugin
      }
    }, 1000);
  }

  private calculateMemoryPressure(): 'low' | 'medium' | 'high' {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usagePercentage = (memoryUsage.rss / totalMemory) * 100;

    if (usagePercentage < 50) return 'low';
    if (usagePercentage < 80) return 'medium';
    return 'high';
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

export interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  timestamp: Date;
}

export interface MemoryReport {
  timestamp: Date;
  system: NodeJS.MemoryUsage;
  totalPluginMemory: number;
  plugins: Array<{
    pluginId: string;
    stats: MemoryStats;
    limit?: number;
  }>;
  memoryPressure: 'low' | 'medium' | 'high';
}