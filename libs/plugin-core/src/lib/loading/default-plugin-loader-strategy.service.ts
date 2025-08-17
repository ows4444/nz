import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PluginLoaderStrategy } from '../types/plugin-loader-strategy.interface';
import {
  PluginManifest,
  PluginLoadResult,
  PluginLoadOptions,
  PluginInstance,
  PluginState,
} from '../types/plugin-strict-interfaces';
import { DynamicPluginModuleGeneratorService, GeneratedPluginModule } from './dynamic-plugin-module-generator.service';

@Injectable()
export class DefaultPluginLoaderStrategy implements PluginLoaderStrategy {
  readonly name = 'default';
  readonly priority = 0;
  private readonly logger = new Logger(DefaultPluginLoaderStrategy.name);

  constructor(
    private readonly moduleGenerator: DynamicPluginModuleGeneratorService,
    private readonly moduleRef: ModuleRef
  ) {}

  supports(type: string): boolean {
    // This strategy supports 'default' or 'javascript' types
    return type === 'default' || type === 'javascript' || type === 'js';
  }

  canLoad(manifest: PluginManifest): boolean {
    // This is the default strategy - it can load any manifest with a valid entry point
    return !!manifest.entryPoint && manifest.entryPoint.endsWith('.js');
  }

  async load(
    manifest: PluginManifest,
    options?: PluginLoadOptions
  ): Promise<PluginLoadResult> {
    try {
      const startTime = Date.now();
      
      // Apply timeout if specified
      const timeout = options?.timeout || 30000;
      
      this.logger.log(
        `Loading plugin module for ${manifest.id} using dynamic module generator (timeout: ${timeout}ms)`
      );

      // Generate dynamic module from manifest
      const generatedModule = await this.moduleGenerator.generatePluginModule(
        manifest
      );

      if (!generatedModule) {
        return {
          success: false,
          error: new Error(
            `Failed to generate dynamic module for ${manifest.id}`
          ),
        };
      }

      // Register the dynamic module with NestJS
      await this.registerDynamicModule(manifest.id, generatedModule);

      const loadTime = Date.now() - startTime;

      // Create plugin instance
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
        instance: generatedModule.moduleClass,
        state: PluginState.LOADED,
        metadata: {
          loadedAt: new Date(),
          loadTime,
          dependencies: [],
        },
      };

      this.logger.log(
        `Successfully loaded plugin ${manifest.id} in ${loadTime}ms with ` +
          `${generatedModule.metadata.controllers.length} controllers and ` +
          `${generatedModule.metadata.providers.length} providers`
      );

      return {
        success: true,
        plugin: pluginInstance,
      };
    } catch (error) {
      this.logger.error(`Failed to load plugin ${manifest.id}`, error);
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  async unload(pluginId: string): Promise<boolean> {
    try {
      this.logger.log(`Unloading plugin ${pluginId}`);
      // For now, just return true as Node.js modules can't be easily unloaded
      return true;
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}`, error);
      return false;
    }
  }

  private async registerDynamicModule(
    pluginId: string,
    generatedModule: GeneratedPluginModule
  ): Promise<void> {
    try {
      this.logger.log(`Registering dynamic module for plugin: ${pluginId}`);

      // Store the module in the registry for later access
      const moduleRegistry = this.moduleRef.get('PLUGIN_MODULE_REGISTRY', { strict: false });
      if (moduleRegistry) {
        moduleRegistry.set(pluginId, generatedModule);
      }

      // Register the module with NestJS
      await this.registerModuleWithNestJS(generatedModule);
      
      this.logger.log(
        `Successfully registered dynamic module for plugin: ${pluginId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to register dynamic module for plugin ${pluginId}:`,
        error
      );
      throw error;
    }
  }

  private async registerModuleWithNestJS(generatedModule: GeneratedPluginModule): Promise<void> {
    try {
      this.logger.log(`Registering plugin module ${generatedModule.moduleClass.name} with NestJS`);
      
      // Store the module in the registry
      try {
        const moduleRegistry = this.moduleRef.get('PLUGIN_MODULE_REGISTRY', { strict: false });
        if (moduleRegistry) {
          moduleRegistry.set(generatedModule.moduleClass.name, generatedModule);
          this.logger.log(`Stored plugin module ${generatedModule.moduleClass.name} in registry`);
        }
      } catch (registryError) {
        this.logger.warn(`Could not access plugin registry:`, registryError);
      }

      // Attempt to register the module with the application context
      try {
        // Get the container and register the module
        const container = this.moduleRef['container'];
        if (container && typeof container.addModule === 'function') {
          await container.addModule(generatedModule.moduleClass, []);
          this.logger.log(`Successfully registered module ${generatedModule.moduleClass.name} with container`);
        } else {
          this.logger.warn('Container.addModule not available - module stored in registry only');
        }
      } catch (containerError) {
        this.logger.warn(`Could not register with container:`, containerError);
      }
      
      // Log the available controllers
      const { controllers } = generatedModule.metadata;
      for (const controllerClass of controllers) {
        this.logger.log(`Plugin controller available: ${controllerClass.name}`);
      }
      
    } catch (error) {
      this.logger.error('Failed to register module with NestJS:', error);
      throw error;
    }
  }

}
