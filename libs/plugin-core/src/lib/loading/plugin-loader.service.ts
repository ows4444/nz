import { Injectable, Logger } from '@nestjs/common';
import { PluginLoaderStrategy } from '../types/plugin-loader-strategy.interface';
import { PluginManifest, PluginLoadResult, PluginLoadOptions } from '../types/plugin-strict-interfaces';
import { PluginLoaderContext } from './plugin-loader-context';

@Injectable()
export class PluginLoaderService {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly strategies = new Map<string, PluginLoaderStrategy>();

  registerStrategy(type: string, strategy: PluginLoaderStrategy): void {
    this.strategies.set(type, strategy);
    this.logger.log(`Registered plugin loader strategy for type: ${type}`);
  }

  async loadPlugin(manifest: PluginManifest, options?: PluginLoadOptions): Promise<PluginLoadResult> {
    const context = new PluginLoaderContext(manifest, options);
    
    try {
      const strategy = this.findStrategy(manifest);
      if (!strategy) {
        return {
          success: false,
          error: new Error(`No loader strategy found for plugin type`)
        };
      }

      this.logger.log(`Loading plugin ${manifest.id} using strategy`);
      
      const result = await this.executeWithTimeout(
        () => strategy.load(manifest, options),
        context.getTimeout()
      );

      if (result.success) {
        this.logger.log(`Successfully loaded plugin ${manifest.id}`);
      } else {
        this.logger.error(`Failed to load plugin ${manifest.id}`, result.error);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error loading plugin ${manifest.id}`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      for (const strategy of this.strategies.values()) {
        const result = await strategy.unload(pluginId);
        if (result) {
          this.logger.log(`Successfully unloaded plugin ${pluginId}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Error unloading plugin ${pluginId}`, error);
      return false;
    }
  }

  private findStrategy(manifest: PluginManifest): PluginLoaderStrategy | null {
    for (const strategy of this.strategies.values()) {
      if (strategy.canLoad(manifest)) {
        return strategy;
      }
    }
    return null;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Plugin load timeout')), timeout)
      )
    ]);
  }
}