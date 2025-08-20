import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit, OnModuleDestroy, Type } from '@nestjs/common';
import { PluginCoreAsyncConfig, EnhancedPluginRegistryEntry, PluginStatistics, PluginModuleCreationResult } from '../types';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginErrorHandler, PluginErrorCode } from './plugin-error-handler.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PluginMetadataService } from './plugin-metadata.service';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginStatisticsService } from './plugin-statistics.service';
import { PluginLifecycleManagerService } from './plugin-lifecycle-manager.service';
import { PLUGIN_CONSTANTS } from '../constants';

/**
 * Central plugin management service that coordinates all plugin operations
 * Provides a unified interface for plugin discovery, loading, and lifecycle management
 */
@Injectable()
export class PluginManagerService implements OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PluginManagerService.name);
  private isInitialized = false;

  constructor(
    private readonly pluginMetadataService: PluginMetadataService,
    private readonly pluginRegistryService: PluginRegistryService,
    private readonly pluginStatisticsService: PluginStatisticsService,
    private readonly pluginLifecycleManagerService: PluginLifecycleManagerService
  ) {}

  /**
   * Discover and load plugin modules from configuration
   */
  static discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    return PluginErrorHandler.wrapDiscoveryOperation(() => PluginDiscoveryService.discoverPluginModules(options), PluginErrorCode.LOADING_FAILED, PLUGIN_CONSTANTS.ERRORS.LOADING_FAILED, 'system');
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
    return await this.pluginLifecycleManagerService.registerPlugin(pluginName, pluginInstance, module, manifest);
  }

  /**
   * Get a loaded plugin entry by name
   */
  getPlugin(pluginName: string): EnhancedPluginRegistryEntry | undefined {
    return this.pluginRegistryService.get(pluginName);
  }

  /**
   * Get plugin instance by name
   */
  getPluginInstance(pluginName: string): any | undefined {
    return this.pluginRegistryService.getInstance(pluginName);
  }

  /**
   * Get all loaded plugin names
   */
  getLoadedPluginNames(): string[] {
    return this.pluginRegistryService.getPluginNames();
  }

  /**
   * Get all plugin entries
   */
  getAllPlugins(): EnhancedPluginRegistryEntry[] {
    return this.pluginRegistryService.getAll();
  }

  /**
   * Get comprehensive plugin statistics
   */
  getStatistics(): PluginStatistics {
    return this.pluginStatisticsService.getStatistics();
  }

  /**
   * Update plugin activity timestamp
   */
  updatePluginActivity(pluginName: string): void {
    this.pluginLifecycleManagerService.updatePluginActivity(pluginName);
  }

  /**
   * Mark a plugin as inactive
   */
  async deactivatePlugin(pluginName: string): Promise<boolean> {
    return await this.pluginLifecycleManagerService.deactivatePlugin(pluginName);
  }

  /**
   * Mark a plugin as active
   */
  async activatePlugin(pluginName: string): Promise<boolean> {
    return await this.pluginLifecycleManagerService.activatePlugin(pluginName);
  }

  /**
   * Remove and unload a plugin
   */
  async unloadPlugin(pluginName: string): Promise<boolean> {
    return await this.pluginLifecycleManagerService.unloadPlugin(pluginName);
  }

  /**
   * Handle plugin error and emit error event
   */
  async handlePluginError(pluginName: string, error: Error): Promise<void> {
    return await this.pluginLifecycleManagerService.handlePluginError(pluginName, error);
  }

  /**
   * Get the lifecycle service for direct access
   */
  getLifecycleService(): PluginLifecycleService {
    return this.pluginLifecycleManagerService.getLifecycleService();
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
    this.logger.log(PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.CORE_INITIALIZED);

    const pluginWrappers = this.pluginMetadataService.findAllPluginWrappers();

    for (const { wrapper, metadata, type } of pluginWrappers) {
      this.logger.log(`${PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.PLUGIN_FOUND} ${type}: ${wrapper.metatype?.name} ${JSON.stringify(metadata)}`);

      if (wrapper.metatype && metadata.enabled !== false) {
        this.pluginMetadataService.updatePluginMetadata(wrapper, metadata);
        this.logger.log(`${PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.PLUGIN_ENABLED} ${type}: ${wrapper.metatype.name}`);
      }
    }
  }

  /**
   * Module destruction lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log(PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.CORE_DESTROYED);
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

      this.logger.log(`${PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.MANAGER_INITIALIZED} with ${this.pluginRegistryService.size()} plugins`);
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
      this.pluginRegistryService.clear();

      // Clear errors
      PluginErrorHandler.clearErrors();

      this.isInitialized = false;
      this.logger.log(PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.MANAGER_SHUTDOWN);
    } catch (error) {
      this.logger.error('Error during Plugin Manager shutdown:', error);
    }
  }
}
