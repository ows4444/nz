import { Injectable, Logger, Type } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PluginCoreAsyncConfig, PluginCoreConfig } from '../types';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PluginDependencyResolver, ResolvedPlugin } from '../utils/plugin-dependency-resolver';
import { PLUGIN_CONSTANTS } from '../constants';

@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);

  // Static singleton instances for performance optimization
  private static manifestValidatorInstance: PluginManifestValidator | null = null;
  private static moduleFactoryInstance: PluginModuleFactory | null = null;
  private static configValidatorInstance: PluginConfigValidator | null = null;
  private static dependencyResolverInstance: PluginDependencyResolver | null = null;
  private static discoveryServiceInstance: PluginDiscoveryService | null = null;

  constructor(
    private readonly manifestValidator: PluginManifestValidator,
    private readonly moduleFactory: PluginModuleFactory,
    private readonly configValidator: PluginConfigValidator,
    private readonly dependencyResolver: PluginDependencyResolver
  ) {}

  discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    if (!this.configValidator.validateAsyncConfig(options)) {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.INVALID_ASYNC_CONFIG);
      return [];
    }

    try {
      const pluginOptions = this.getPluginOptionsSync(options);

      if (!pluginOptions) {
        this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.CANNOT_PRE_DISCOVER_ASYNC);
        return [];
      }

      if (pluginOptions.skipRuntimeLoading) {
        this.logger.log(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.SKIP_RUNTIME_LOADING);
        return [];
      }

      return this.loadPluginModulesFromSearchPaths(pluginOptions);
    } catch (error) {
      this.logger.error(PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.COULD_NOT_PRE_DISCOVER, error);
      return [];
    }
  }

  /**
   * Get or create singleton instance of PluginManifestValidator
   */
  private static getManifestValidatorInstance(): PluginManifestValidator {
    if (!this.manifestValidatorInstance) {
      this.manifestValidatorInstance = new PluginManifestValidator();
    }
    return this.manifestValidatorInstance;
  }

  /**
   * Get or create singleton instance of PluginModuleFactory
   */
  private static getModuleFactoryInstance(): PluginModuleFactory {
    if (!this.moduleFactoryInstance) {
      this.moduleFactoryInstance = new PluginModuleFactory();
    }
    return this.moduleFactoryInstance;
  }

  /**
   * Get or create singleton instance of PluginConfigValidator
   */
  private static getConfigValidatorInstance(): PluginConfigValidator {
    if (!this.configValidatorInstance) {
      this.configValidatorInstance = new PluginConfigValidator();
    }
    return this.configValidatorInstance;
  }

  /**
   * Get or create singleton instance of PluginDependencyResolver
   */
  private static getDependencyResolverInstance(): PluginDependencyResolver {
    if (!this.dependencyResolverInstance) {
      this.dependencyResolverInstance = new PluginDependencyResolver();
    }
    return this.dependencyResolverInstance;
  }

  /**
   * Get or create singleton instance of PluginDiscoveryService
   */
  private static getDiscoveryServiceInstance(): PluginDiscoveryService {
    if (!this.discoveryServiceInstance) {
      this.discoveryServiceInstance = new PluginDiscoveryService(
        this.getManifestValidatorInstance(),
        this.getModuleFactoryInstance(),
        this.getConfigValidatorInstance(),
        this.getDependencyResolverInstance()
      );
    }
    return this.discoveryServiceInstance;
  }

  static discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    // Optimized static method using singleton instances for better performance
    const instance = this.getDiscoveryServiceInstance();
    return instance.discoverPluginModules(options);
  }

  /**
   * Clear singleton instances (useful for testing or memory cleanup)
   */
  static clearSingletonInstances(): void {
    this.manifestValidatorInstance = null;
    this.moduleFactoryInstance = null;
    this.configValidatorInstance = null;
    this.dependencyResolverInstance = null;
    this.discoveryServiceInstance = null;
  }

  /**
   * Get performance statistics for singleton instances
   */
  static getSingletonStats(): {
    manifestValidatorCreated: boolean;
    moduleFactoryCreated: boolean;
    configValidatorCreated: boolean;
    dependencyResolverCreated: boolean;
    discoveryServiceCreated: boolean;
    allInstancesCreated: boolean;
  } {
    return {
      manifestValidatorCreated: this.manifestValidatorInstance !== null,
      moduleFactoryCreated: this.moduleFactoryInstance !== null,
      configValidatorCreated: this.configValidatorInstance !== null,
      dependencyResolverCreated: this.dependencyResolverInstance !== null,
      discoveryServiceCreated: this.discoveryServiceInstance !== null,
      allInstancesCreated:
        this.manifestValidatorInstance !== null &&
        this.moduleFactoryInstance !== null &&
        this.configValidatorInstance !== null &&
        this.dependencyResolverInstance !== null &&
        this.discoveryServiceInstance !== null,
    };
  }

  private getPluginOptionsSync(options: PluginCoreAsyncConfig): PluginCoreConfig | null {
    if (!options?.useFactory) {
      return null;
    }

    try {
      const pluginOptionsResult = options.useFactory();

      if (pluginOptionsResult instanceof Promise) {
        return null;
      }

      const config = pluginOptionsResult as PluginCoreConfig;
      return this.configValidator.validateConfig(config) ? this.configValidator.sanitizeConfig(config) : null;
    } catch (error) {
      this.logger.warn('Failed to get plugin options synchronously:', error);
      return null;
    }
  }

  private loadPluginModulesFromSearchPaths(pluginOptions: PluginCoreConfig): Type<any>[] {
    const pluginModules: Type<any>[] = [];

    // First, collect all plugin manifests with their paths
    const allPluginData: ResolvedPlugin[] = [];

    for (const searchPath of Array.from(pluginOptions.searchPaths)) {
      const resolvedPath = path.resolve(searchPath);

      if (!this.validateSearchPath(resolvedPath)) {
        continue;
      }

      const pluginDirs = this.getPluginDirectories(resolvedPath);
      const validPluginDirs = this.manifestValidator.discoverValidPluginDirs(resolvedPath, pluginDirs);

      this.collectPluginManifests(resolvedPath, validPluginDirs, allPluginData);
    }

    // Validate dependencies before attempting to resolve order
    const dependencyErrors = this.dependencyResolver.validateDependencies(allPluginData);
    if (dependencyErrors.length > 0) {
      this.logger.error('Plugin dependency validation failed:', dependencyErrors);
      return []; // Return empty array if dependencies are invalid
    }

    // Resolve loading order based on dependencies
    let sortedPlugins: ResolvedPlugin[] = [];
    try {
      sortedPlugins = this.dependencyResolver.resolveLoadingOrder(allPluginData);
      this.logger.log(`Resolved plugin loading order: ${sortedPlugins.map((p) => p.manifest.name).join(' -> ')}`);
    } catch (error) {
      this.logger.error('Failed to resolve plugin loading order:', error);
      return []; // Return empty array if resolution fails
    }

    // Load plugins in dependency order
    this.loadPluginsInOrder(sortedPlugins, pluginModules);

    return pluginModules;
  }

  private validateSearchPath(resolvedPath: string): boolean {
    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.SEARCH_PATH_NOT_EXIST}: ${resolvedPath}`);
      return false;
    }
    return true;
  }

  private getPluginDirectories(resolvedPath: string): string[] {
    return fs
      .readdirSync(resolvedPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  }

  /**
   * Collects plugin manifests and their metadata from valid plugin directories
   */
  private collectPluginManifests(resolvedPath: string, pluginDirs: string[], pluginData: ResolvedPlugin[]): void {
    for (const pluginDir of pluginDirs) {
      try {
        const manifestPath = path.join(resolvedPath, pluginDir, PLUGIN_CONSTANTS.MANIFEST_FILE);
        const manifest = this.manifestValidator.loadAndValidateManifest(manifestPath, pluginDir);

        if (manifest) {
          pluginData.push({
            manifest,
            resolvedPath,
            pluginDir,
          });
        }
      } catch (error) {
        this.logger.warn(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.FAILED_TO_PROCESS_PLUGIN} ${pluginDir}:`, error);
      }
    }
  }

  /**
   * Loads plugins in the correct dependency order
   */
  private loadPluginsInOrder(sortedPlugins: ResolvedPlugin[], pluginModules: Type<any>[]): void {
    for (const pluginData of sortedPlugins) {
      try {
        const pluginModule = this.moduleFactory.createPluginModule(pluginData.manifest, pluginData.resolvedPath, pluginData.pluginDir);

        if (pluginModule) {
          pluginModules.push(pluginModule.module);
          this.logger.log(`${PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.PLUGIN_LOADED}: ${pluginData.manifest.name}`);
        }
      } catch (error) {
        this.logger.error(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.FAILED_TO_PROCESS_PLUGIN} ${pluginData.manifest.name}:`, error);
      }
    }
  }
}
