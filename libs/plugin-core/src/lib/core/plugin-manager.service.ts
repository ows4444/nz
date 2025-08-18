import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit, OnModuleDestroy, Type } from '@nestjs/common';
import { PluginCoreAsyncConfig, EnhancedPluginRegistryEntry, PluginStatistics, PluginModuleCreationResult } from '../types';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginErrorHandler, PluginErrorCode } from './plugin-error-handler.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PluginMetadataService } from './plugin-metadata.service';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PLUGIN_CONSTANTS } from '../constants';

/**
 * Central plugin management service that coordinates all plugin operations
 * Provides a unified interface for plugin discovery, loading, and lifecycle management
 */
@Injectable()
export class PluginManagerService implements OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PluginManagerService.name);
  private readonly loadedPlugins = new Map<string, EnhancedPluginRegistryEntry>();
  private isInitialized = false;
  private readonly startTime = Date.now();

  constructor(
    private readonly pluginMetadataService: PluginMetadataService,
    private readonly pluginLifecycleService: PluginLifecycleService
  ) {}

  /**
   * Discover and load plugin modules from configuration
   */
  static discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    return PluginErrorHandler.wrapDiscoveryOperation(
      () => PluginDiscoveryService.discoverPluginModules(options),
      PluginErrorCode.LOADING_FAILED,
      PLUGIN_CONSTANTS.ERRORS.LOADING_FAILED,
      'system'
    );
  }

  /**
   * Create a plugin module from manifest and paths
   */
  static createPluginModule(manifest: any, basePath: string, pluginDir: string): PluginModuleCreationResult {
    return PluginErrorHandler.wrapModuleCreationOperation(
      () => PluginModuleFactory.createPluginModule(manifest, basePath, pluginDir),
      PluginErrorCode.LOADING_FAILED,
      PLUGIN_CONSTANTS.ERRORS.LOADING_FAILED,
      (error: string) => ({
        success: false,
        error,
        warnings: [],
      }),
      manifest?.name,
      'module'
    );
  }

  /**
   * Validate and discover plugin directories
   */
  static discoverAndValidatePluginManifests(resolvedPath: string, pluginPaths: string[]): string[] {
    return PluginErrorHandler.wrapDiscoveryOperation(
      () => PluginManifestValidator.discoverValidPluginDirs(resolvedPath, pluginPaths),
      PluginErrorCode.VALIDATION_FAILED,
      PLUGIN_CONSTANTS.ERRORS.VALIDATION_FAILED,
      'system'
    );
  }

  /**
   * Register a loaded plugin with enhanced metadata
   */
  async registerPlugin(pluginName: string, pluginInstance: any, module?: Type<any>, manifest?: any): Promise<void> {
    if (this.loadedPlugins.has(pluginName)) {
      this.logger.warn(`Plugin ${pluginName} is already registered, overwriting`);
    }

    const entry: EnhancedPluginRegistryEntry = {
      name: pluginName,
      instance: pluginInstance,
      module: module as Type<any>,
      manifest,
      registeredAt: new Date(),
      status: 'active',
      lastActivity: new Date(),
      metrics: {
        loadTime: Date.now() - this.startTime,
        memoryUsage: 0,
        requestCount: 0,
      },
    };

    this.loadedPlugins.set(pluginName, entry);
    this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.PLUGIN_DISCOVERED}: ${pluginName}`);

    // Emit load lifecycle event
    try {
      await this.pluginLifecycleService.emit('load', {
        pluginName,
        manifest,
        instance: pluginInstance,
        timestamp: new Date(),
        context: { module: module?.name }
      });
    } catch (error) {
      this.logger.error(`Error emitting load event for plugin ${pluginName}:`, error);
    }
  }

  /**
   * Get a loaded plugin entry by name
   */
  getPlugin(pluginName: string): EnhancedPluginRegistryEntry | undefined {
    return this.loadedPlugins.get(pluginName);
  }

  /**
   * Get plugin instance by name
   */
  getPluginInstance(pluginName: string): any | undefined {
    return this.loadedPlugins.get(pluginName)?.instance;
  }

  /**
   * Get all loaded plugin names
   */
  getLoadedPluginNames(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  /**
   * Get all plugin entries
   */
  getAllPlugins(): EnhancedPluginRegistryEntry[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get comprehensive plugin statistics
   */
  getStatistics(): PluginStatistics {
    const plugins = this.getAllPlugins();
    return {
      totalRegistered: plugins.length,
      activePlugins: plugins.filter((p) => p.status === 'active').length,
      inactivePlugins: plugins.filter((p) => p.status === 'inactive').length,
      errorPlugins: plugins.filter((p) => p.status === 'error').length,
      pluginNames: plugins.map((p) => p.name),
      loadTime: plugins.reduce((total, p) => total + (p.metrics?.loadTime || 0), 0),
      memoryUsage: plugins.reduce((total, p) => total + (p.metrics?.memoryUsage || 0), 0),
    };
  }

  /**
   * Update plugin activity timestamp
   */
  updatePluginActivity(pluginName: string): void {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.lastActivity = new Date();
      if (plugin.metrics) {
        plugin.metrics.requestCount++;
      }
    }
  }

  /**
   * Mark a plugin as inactive
   */
  async deactivatePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.status = 'inactive';
      this.logger.log(`Plugin ${pluginName} deactivated`);

      // Emit disable lifecycle event
      try {
        await this.pluginLifecycleService.emit('disable', {
          pluginName,
          manifest: plugin.manifest,
          instance: plugin.instance,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error(`Error emitting disable event for plugin ${pluginName}:`, error);
      }

      return true;
    }
    return false;
  }

  /**
   * Mark a plugin as active
   */
  async activatePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.status = 'active';
      plugin.lastActivity = new Date();
      this.logger.log(`Plugin ${pluginName} activated`);

      // Emit enable lifecycle event
      try {
        await this.pluginLifecycleService.emit('enable', {
          pluginName,
          manifest: plugin.manifest,
          instance: plugin.instance,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error(`Error emitting enable event for plugin ${pluginName}:`, error);
      }

      return true;
    }
    return false;
  }

  /**
   * Remove and unload a plugin
   */
  async unloadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      // Emit unload lifecycle event before removal
      try {
        await this.pluginLifecycleService.emit('unload', {
          pluginName,
          manifest: plugin.manifest,
          instance: plugin.instance,
          timestamp: new Date()
        });
      } catch (error) {
        this.logger.error(`Error emitting unload event for plugin ${pluginName}:`, error);
      }

      this.loadedPlugins.delete(pluginName);
      this.logger.log(`Plugin ${pluginName} unloaded`);
      return true;
    }
    return false;
  }

  /**
   * Handle plugin error and emit error event
   */
  async handlePluginError(pluginName: string, error: Error): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.status = 'error';
    }

    try {
      await this.pluginLifecycleService.emit('error', {
        pluginName,
        manifest: plugin?.manifest,
        instance: plugin?.instance,
        timestamp: new Date(),
        error
      });
    } catch (lifecycleError) {
      this.logger.error(`Error emitting error event for plugin ${pluginName}:`, lifecycleError);
    }
  }

  /**
   * Get the lifecycle service for direct access
   */
  getLifecycleService(): PluginLifecycleService {
    return this.pluginLifecycleService;
  }

  /**
   * Validate plugin configuration
   */
  validateConfiguration(options: PluginCoreAsyncConfig): boolean {
    return PluginConfigValidator.validateAsyncConfig(options);
  }

  /**
   * Check if plugin manager is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Module initialization lifecycle hook - integrates PluginCore functionality
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(PLUGIN_CONSTANTS.MESSAGES.CORE_INITIALIZED);

    const pluginWrappers = this.pluginMetadataService.findAllPluginWrappers();

    for (const { wrapper, metadata, type } of pluginWrappers) {
      this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.PLUGIN_FOUND} ${type}: ${wrapper.metatype?.name } ${JSON.stringify(metadata)}`);

      if (wrapper.metatype && metadata.enabled !== false) {
        this.pluginMetadataService.updatePluginMetadata(wrapper, metadata);
        this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.PLUGIN_ENABLED} ${type}: ${wrapper.metatype.name}`);
      }
    }
  }

  /**
   * Module destruction lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log(PLUGIN_CONSTANTS.MESSAGES.CORE_DESTROYED);
  }

  /**
   * Application bootstrap lifecycle hook
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Plugin Manager Service initializing...');

    try {
      // Clear any previous errors
      PluginErrorHandler.clearErrors();

      // Mark as initialized
      this.isInitialized = true;

      this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.MANAGER_INITIALIZED} with ${this.loadedPlugins.size} plugins`);
    } catch (error) {
      this.logger.error('Failed to initialize Plugin Manager:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Application shutdown lifecycle hook
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Plugin Manager shutting down... (signal: ${signal})`);

    try {
      // Log final statistics
      const stats = this.getStatistics();
      this.logger.log('Final plugin statistics:', stats);

      // Clear loaded plugins
      this.loadedPlugins.clear();

      // Clear errors
      PluginErrorHandler.clearErrors();

      this.isInitialized = false;
      this.logger.log(PLUGIN_CONSTANTS.MESSAGES.MANAGER_SHUTDOWN);
    } catch (error) {
      this.logger.error('Error during Plugin Manager shutdown:', error);
    }
  }
}
