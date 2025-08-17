import { Injectable, Logger } from '@nestjs/common';
import { PluginInstance, PluginManifest, PluginState } from '../types/plugin-strict-interfaces';

@Injectable()
export class PluginInstantiationService {
  private readonly logger = new Logger(PluginInstantiationService.name);

  async instantiatePlugin(manifest: PluginManifest, moduleExports: any): Promise<PluginInstance> {
    try {
      this.logger.log(`Instantiating plugin ${manifest.id}`);

      const startTime = Date.now();
      const instance = await this.createInstance(moduleExports, manifest);
      const loadTime = Date.now() - startTime;

      const pluginInstance: PluginInstance = {
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
        instance,
        state: PluginState.LOADED,
        metadata: {
          loadedAt: new Date(),
          loadTime,
          dependencies: []
        }
      };

      this.logger.log(`Successfully instantiated plugin ${manifest.id} in ${loadTime}ms`);
      return pluginInstance;
    } catch (error) {
      this.logger.error(`Failed to instantiate plugin ${manifest.id}`, error);
      throw error;
    }
  }

  async destroyInstance(pluginInstance: PluginInstance): Promise<boolean> {
    try {
      this.logger.log(`Destroying instance for plugin ${pluginInstance.plugin.id}`);

      // Call cleanup if available
      if (pluginInstance.instance && 
          typeof pluginInstance.instance === 'object' && 
          'destroy' in pluginInstance.instance &&
          typeof (pluginInstance.instance as any).destroy === 'function') {
        await (pluginInstance.instance as any).destroy();
      }

      // Clear references
      pluginInstance.instance = null;
      pluginInstance.state = PluginState.UNLOADED;

      this.logger.log(`Successfully destroyed instance for plugin ${pluginInstance.plugin.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to destroy instance for plugin ${pluginInstance.plugin.id}`, error);
      return false;
    }
  }

  private async createInstance(moduleExports: any, manifest: PluginManifest): Promise<any> {
    // Handle different export patterns
    if (typeof moduleExports === 'function') {
      // Constructor function
      return new moduleExports();
    }

    if (moduleExports && typeof moduleExports.default === 'function') {
      // ES6 default export
      return new moduleExports.default();
    }

    if (moduleExports && typeof moduleExports.create === 'function') {
      // Factory function
      return await moduleExports.create(manifest);
    }

    if (moduleExports && typeof moduleExports.initialize === 'function') {
      // Initialization function
      return await moduleExports.initialize(manifest);
    }

    // Return as-is if it's already an instance
    if (moduleExports && typeof moduleExports === 'object') {
      return moduleExports;
    }

    throw new Error(`Unable to instantiate plugin ${manifest.id}: no valid export pattern found`);
  }

  validateInstance(instance: any, manifest: PluginManifest): boolean {
    if (!instance) {
      this.logger.error(`Plugin ${manifest.id} instance is null or undefined`);
      return false;
    }

    // Check for required methods if specified in manifest
    if (manifest.exports) {
      for (const exportName of manifest.exports) {
        if (typeof instance[exportName] !== 'function') {
          this.logger.error(`Plugin ${manifest.id} missing required export: ${exportName}`);
          return false;
        }
      }
    }

    return true;
  }
}