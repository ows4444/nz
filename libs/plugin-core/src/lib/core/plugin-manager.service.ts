import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit, OnModuleDestroy, Type } from '@nestjs/common';
import { PluginCoreAsyncConfig, EnhancedPluginRegistryEntry, PluginStatistics, PluginModuleCreationResult } from '../types';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginErrorHandler, PluginErrorCode } from './plugin-error-handler.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PluginMetadataService } from './plugin-metadata.service';
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

  constructor(private readonly pluginMetadataService: PluginMetadataService) {}

  /**
   * Discover and load plugin modules from configuration
   */
  static discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    return (
      PluginErrorHandler.wrapWithErrorHandling(() => PluginDiscoveryService.discoverPluginModules(options), PluginErrorCode.LOADING_FAILED, PLUGIN_CONSTANTS.ERRORS.LOADING_FAILED, 'system') || []
    );
  }

  /**
   * Create a plugin module from manifest and paths
   */
  static createPluginModule(manifest: any, basePath: string, pluginDir: string): PluginModuleCreationResult {
    const result = PluginErrorHandler.wrapWithErrorHandling(
      () => PluginModuleFactory.createPluginModule(manifest, basePath, pluginDir),
      PluginErrorCode.LOADING_FAILED,
      PLUGIN_CONSTANTS.ERRORS.LOADING_FAILED,
      manifest?.name,
      'module'
    );

    if (result && result.module) {
      return {
        success: true,
        module: result.module,
        manifest: result.manifest,
        warnings: [],
      };
    }

    return {
      success: false,
      error: PLUGIN_CONSTANTS.ERRORS.LOADING_FAILED,
      warnings: [],
    };
  }

  /**
   * Validate and discover plugin directories
   */
  static discoverAndValidatePluginManifests(resolvedPath: string, pluginPaths: string[]): string[] {
    return (
      PluginErrorHandler.wrapWithErrorHandling(
        () => PluginManifestValidator.discoverValidPluginDirs(resolvedPath, pluginPaths),
        PluginErrorCode.VALIDATION_FAILED,
        PLUGIN_CONSTANTS.ERRORS.VALIDATION_FAILED,
        'system'
      ) || []
    );
  }

  /**
   * Register a loaded plugin with enhanced metadata
   */
  registerPlugin(pluginName: string, pluginInstance: any, module?: Type<any>, manifest?: any): void {
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
  deactivatePlugin(pluginName: string): boolean {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.status = 'inactive';
      this.logger.log(`Plugin ${pluginName} deactivated`);
      return true;
    }
    return false;
  }

  /**
   * Mark a plugin as active
   */
  activatePlugin(pluginName: string): boolean {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.status = 'active';
      plugin.lastActivity = new Date();
      this.logger.log(`Plugin ${pluginName} activated`);
      return true;
    }
    return false;
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
      this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.PLUGIN_FOUND} ${type}: ${wrapper.metatype?.name}`, metadata);

      if (wrapper.metatype && metadata.enabled !== false) {
        this.pluginMetadataService.updatePluginMetadata(wrapper, metadata);
        this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.PLUGIN_DISABLED} ${type}: ${wrapper.metatype.name}`);
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
