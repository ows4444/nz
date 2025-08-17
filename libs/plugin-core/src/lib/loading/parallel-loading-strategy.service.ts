import { Injectable, Logger } from '@nestjs/common';
import { PluginLoadingStrategy } from '../types/plugin-loading-strategy.interface';
import { PluginManifest, PluginLoadResult, PluginState } from '../types/plugin-strict-interfaces';

@Injectable()
export class ParallelLoadingStrategyService implements PluginLoadingStrategy {
  readonly name = 'parallel';
  readonly description = 'Loads plugins in parallel for faster startup';
  readonly maxConcurrency = 5;
  private readonly logger = new Logger(ParallelLoadingStrategyService.name);

  async loadPlugins(manifests: PluginManifest[]): Promise<PluginLoadResult[]> {
    this.logger.log(`Loading ${manifests.length} plugins in parallel`);

    const loadPromises = manifests.map(manifest => this.loadSinglePlugin(manifest));
    
    try {
      const results = await Promise.allSettled(loadPromises);
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          this.logger.error(`Failed to load plugin ${manifests[index].id}`, result.reason);
          return {
            success: false,
            error: result.reason
          };
        }
      });
    } catch (error) {
      this.logger.error('Error during parallel plugin loading', error);
      throw error;
    }
  }

  private async loadSinglePlugin(manifest: PluginManifest): Promise<PluginLoadResult> {
    // This would integrate with the actual plugin loader
    // For now, return a mock result
    return {
      success: true,
      plugin: {
        plugin: {
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          license: manifest.license,
          keywords: manifest.keywords,
          dependencies: manifest.dependencies,
          metadata: manifest.metadata
        },
        instance: {},
        state: PluginState.LOADED,
        metadata: {
          loadedAt: new Date(),
          loadTime: 100,
          dependencies: []
        }
      }
    };
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  canHandle(manifests: PluginManifest[]): boolean {
    return manifests.length > 0;
  }

  estimateLoadTime(manifests: PluginManifest[]): number {
    const batchCount = Math.ceil(manifests.length / this.maxConcurrency);
    return batchCount * 1000;
  }
}