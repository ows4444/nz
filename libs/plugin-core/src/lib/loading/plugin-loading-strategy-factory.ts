import { Injectable } from '@nestjs/common';
import { PluginLoadingStrategy } from '../types/plugin-loading-strategy.interface';
import { ParallelLoadingStrategyService } from './parallel-loading-strategy.service';

@Injectable()
export class PluginLoadingStrategyFactory {
  constructor(
    private readonly parallelStrategy: ParallelLoadingStrategyService
  ) {}

  createStrategy(type: 'parallel' | 'sequential'): PluginLoadingStrategy {
    switch (type) {
      case 'parallel':
        return this.parallelStrategy;
      case 'sequential':
        return new SequentialLoadingStrategy();
      default:
        throw new Error(`Unknown loading strategy type: ${type}`);
    }
  }

  getAvailableStrategies(): string[] {
    return ['parallel', 'sequential'];
  }
}

class SequentialLoadingStrategy implements PluginLoadingStrategy {
  readonly name = 'sequential';
  readonly description = 'Loads plugins one by one in sequence';
  readonly maxConcurrency = 1;

  async loadPlugins(manifests: any[]): Promise<any[]> {
    const results: any[] = [];
    for (const manifest of manifests) {
      // Sequential loading implementation would go here
      results.push({ success: true, plugin: manifest });
    }
    return results;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  canHandle(manifests: any[]): boolean {
    return manifests.length > 0;
  }

  estimateLoadTime(manifests: any[]): number {
    return manifests.length * 1000; // 1 second per plugin
  }
}