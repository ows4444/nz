import { Injectable, Logger } from '@nestjs/common';
import { PluginLoaderCoordinator } from '../types/plugin-loader-coordinator.interface';
import { PluginManifest, PluginLoadResult, PluginLoadOptions, PluginInstance } from '../types/plugin-strict-interfaces';
import { PluginLoaderService } from '../loading/plugin-loader.service';
import { PluginDependencyResolverService } from '../security/plugin-dependency-resolver.service';

@Injectable()
export class PluginLoaderCoordinatorService implements PluginLoaderCoordinator {
  private readonly logger = new Logger(PluginLoaderCoordinatorService.name);
  private readonly loadedPlugins = new Map<string, PluginInstance>();

  constructor(
    private readonly loaderService: PluginLoaderService,
    private readonly dependencyResolver: PluginDependencyResolverService
  ) {}

  async loadPlugin(manifest: PluginManifest, options?: PluginLoadOptions): Promise<PluginLoadResult> {
    if (this.isPluginLoaded(manifest.id)) {
      this.logger.warn(`Plugin ${manifest.id} is already loaded`);
      return {
        success: false,
        error: new Error(`Plugin ${manifest.id} is already loaded`)
      };
    }

    try {
      // Resolve dependencies first
      const dependencyOrder = await this.dependencyResolver.resolveDependencies([manifest]);
      
      for (const dependentManifest of dependencyOrder) {
        if (!this.isPluginLoaded(dependentManifest.id)) {
          const result = await this.loaderService.loadPlugin(dependentManifest, options);
          if (result.success && result.plugin) {
            this.loadedPlugins.set(dependentManifest.id, result.plugin);
          } else {
            return result;
          }
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to load plugin ${manifest.id}`, error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async loadPlugins(manifests: PluginManifest[], options?: PluginLoadOptions): Promise<PluginLoadResult[]> {
    this.logger.log(`Loading ${manifests.length} plugins`);

    try {
      const resolvedOrder = await this.dependencyResolver.resolveDependencies(manifests);
      const results: PluginLoadResult[] = [];

      for (const manifest of resolvedOrder) {
        if (!this.isPluginLoaded(manifest.id)) {
          const result = await this.loadPlugin(manifest, options);
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to load plugins', error);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    if (!this.isPluginLoaded(pluginId)) {
      this.logger.warn(`Plugin ${pluginId} is not loaded`);
      return false;
    }

    try {
      const success = await this.loaderService.unloadPlugin(pluginId);
      if (success) {
        this.loadedPlugins.delete(pluginId);
        this.logger.log(`Successfully unloaded plugin ${pluginId}`);
      }
      return success;
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}`, error);
      return false;
    }
  }

  async unloadAllPlugins(): Promise<boolean> {
    const pluginIds = Array.from(this.loadedPlugins.keys());
    let allSuccessful = true;

    for (const pluginId of pluginIds) {
      const success = await this.unloadPlugin(pluginId);
      if (!success) {
        allSuccessful = false;
      }
    }

    return allSuccessful;
  }

  getLoadedPlugins(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  getPluginInstance(pluginId: string): PluginInstance | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  async reloadPlugin(pluginId: string): Promise<PluginLoadResult> {
    this.logger.log(`Reloading plugin ${pluginId}`);
    
    // First unload the plugin
    const unloadSuccess = await this.unloadPlugin(pluginId);
    if (!unloadSuccess) {
      return {
        success: false,
        error: new Error(`Failed to unload plugin ${pluginId} for reload`)
      };
    }

    // Find the original manifest (this would need to be stored or discovered again)
    // For now, return an error indicating this needs to be implemented
    return {
      success: false,
      error: new Error('Plugin reload not fully implemented - manifest rediscovery needed')
    };
  }

  async validateDependencies(manifest: PluginManifest): Promise<boolean> {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return true;
    }

    for (const dependencyId of manifest.dependencies) {
      if (!this.isPluginLoaded(dependencyId)) {
        this.logger.warn(`Plugin ${manifest.id} depends on ${dependencyId} which is not loaded`);
        return false;
      }
    }

    return true;
  }

  getLoadOrder(): string[] {
    // Return plugins sorted by load order (dependencies first)
    const pluginIds = this.getLoadedPlugins();
    
    // For now, return as-is. A full implementation would topologically sort based on dependencies
    return pluginIds;
  }
}