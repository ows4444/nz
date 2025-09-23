import { Injectable, Logger, Optional, Type } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PluginCoreAsyncConfig, PluginCoreConfig } from '../types';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PluginDependencyResolver, ResolvedPlugin } from '../utils/plugin-dependency-resolver';
import { DtoOrchestratorService, DynamicSchemaEntity, SchemaVersion, FieldType } from '@libs/dynamic-dto';
import { PLUGIN_CONSTANTS } from '../constants';

@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);

  constructor(
    private readonly manifestValidator: PluginManifestValidator,
    private readonly moduleFactory: PluginModuleFactory,
    private readonly configValidator: PluginConfigValidator,
    private readonly dependencyResolver: PluginDependencyResolver,
    @Optional() private readonly dtoOrchestratorService?: DtoOrchestratorService
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

      return this.loadPluginModulesFromDisk();
    } catch (error) {
      this.logger.error(PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.COULD_NOT_PRE_DISCOVER, error);
      return [];
    }
  }

  /**
   * Discover and validate plugins with DTO orchestrator service
   */
  async discoverAndValidatePlugins(): Promise<void> {
    this.logger.log('Starting plugin discovery and validation...');

    // Validate DTO orchestrator service is available
    if (!this.dtoOrchestratorService) {
      throw new Error('DtoOrchestratorService is not available for plugin validation');
    }

    const resolvedPath = path.resolve(PLUGIN_CONSTANTS.PLUGIN_DIRECTORY);

    if (!this.validateSearchPath(resolvedPath)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.SEARCH_PATH_NOT_EXIST}: ${resolvedPath}`);
      return;
    }

    const pluginDirs = this.getPluginDirectories(resolvedPath);

    if (pluginDirs.length === 0) {
      this.logger.warn(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.NO_PLUGIN_DIRS_FOUND} ${resolvedPath}`);
      return;
    }
    this.logger.log(`Found ${pluginDirs.length} plugin directories in ${resolvedPath}`);

    // Validate plugin directories
    const validPluginDirs = this.manifestValidator.discoverValidPluginDirs(resolvedPath, pluginDirs);

    if (validPluginDirs.length === 0) {
      this.logger.warn(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.NO_PLUGIN_DIRS_FOUND} ${resolvedPath}`);
      return;
    }

    this.logger.log(`Valid plugin directories found: ${validPluginDirs.join(', ')}`);

    // Load and validate each plugin manifest
    const pluginData: ResolvedPlugin[] = [];

    this.collectPluginManifests(resolvedPath, validPluginDirs, pluginData);

    if (pluginData.length === 0) {
      throw new Error('No valid plugin manifests found');
    }

    const SchemaTest = new DynamicSchemaEntity(
      'test-schema',
      'TestSchema',
      {
        security: {
          type: FieldType.object,
          properties: {
            trustLevel: { type: FieldType.enum, values: ['unverified', 'verified', 'trusted'], default: 'unverified', expose: true },
          },
          nullable: true,
          expose: true,
        },

        level: { type: FieldType.enum, values: ['log', 'debug', 'error'], default: 'debug', expose: true },
      },
      new SchemaVersion(1, 0, 0),
      [], // Required fields
      true // Expose schema for validation
    );

    const result = await this.dtoOrchestratorService.validateData(
      {
        name: 'testUser123',
        age: 30,
        email: 'test@email.com',
        tags: ['example', 'plugin'],
        security: {
          trustLevel: 'verified',
        },
        level: 'debug',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      SchemaTest
    );

    console.log(result);

    // Create schema for plugin manifest validation using DTO orchestrator
    const manifestSchema = new DynamicSchemaEntity(
      'plugin-manifest-schema',
      'PluginManifest',
      {
        name: { type: FieldType.string, pattern: RegExp('^@plugins/[a-z]+$'), maxLength: 18, minLength: 12 },
        version: { type: FieldType.string, format: 'semver' },
        description: { type: FieldType.string, maxLength: 256, expose: true },
        author: { type: FieldType.string, nullable: true, expose: true },
        license: { type: FieldType.string, nullable: true, expose: true },
        keywords: { type: FieldType.array, items: { type: FieldType.string }, expose: true },
        loadOrder: { type: FieldType.number, negative: false, default: 0 },
        critical: { type: FieldType.boolean, expose: true },
        security: {
          type: FieldType.object,
          properties: {
            trustLevel: { type: FieldType.enum, values: ['unverified', 'verified', 'trusted'], default: 'unverified', expose: true },
          },
          nullable: true,
          expose: true,
        },
        permissions: {
          type: FieldType.object,
          properties: {
            services: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
            modules: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
          },
          nullable: true,
        },
        dependencies: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
        module: {
          type: FieldType.object,
          properties: {
            controllers: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
            providers: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
            exports: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
            crossPluginServices: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
            guards: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
          },
          nullable: true,
          expose: true,
        },
        compatibility: {
          type: FieldType.object,
          properties: {
            nodeVersion: { type: FieldType.string, nullable: true, expose: true },
            minimumHostVersion: { type: FieldType.string, nullable: true, expose: true },
            platformSupport: { type: FieldType.array, items: { type: FieldType.string }, nullable: true, expose: true },
          },
          nullable: true,
          expose: true,
        },
      },
      new SchemaVersion(1, 0, 0),
      ['name', 'version', 'loadOrder'], // Required fields
      true
    );

    // TODO: Temporarily disable DTO validation to isolate the issue
    // Validate each manifest with DTO orchestrator service
    for (const pluginResolvedData of pluginData) {
      try {
        const result = await this.dtoOrchestratorService.validateData(pluginResolvedData.manifest, manifestSchema);
        if (!result.isValid) {
          this.logger.error(`Manifest validation failed for plugin: ${pluginResolvedData.manifest.name}`, result.errors);
          throw new Error(`Plugin manifest validation failed for ${pluginResolvedData.manifest.name}: ${result.errors.map((e) => e.message).join(', ')}`);
        }

        this.logger.log(`Manifest validation successful for plugin: ${pluginResolvedData.manifest.name}`);
      } catch (error) {
        this.logger.error(`DTO validation failed for plugin ${pluginResolvedData.manifest.name}:`, error);
        throw new Error(`Plugin manifest DTO validation failed for ${pluginResolvedData.manifest.name}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Plugin discovery and validation completed successfully. Loaded ${pluginData.length} plugins`);
  }

  /**
   * Static method for module-time discovery (creates temporary instances without singleton management)
   * This is needed for module imports during NestJS initialization
   */
  static discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    // Create lightweight temporary instances for module discovery only
    // These instances are not cached and will be garbage collected after use
    const manifestValidator = new PluginManifestValidator();
    const moduleFactory = new PluginModuleFactory();
    const configValidator = new PluginConfigValidator();
    const dependencyResolver = new PluginDependencyResolver();
    // Assuming this is available globally or can be instantiated

    const discoveryService = new PluginDiscoveryService(manifestValidator, moduleFactory, configValidator, dependencyResolver);

    return discoveryService.discoverPluginModules(options);
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

  loadPluginModulesFromDisk(): Type<any>[] {
    const pluginModules: Type<any>[] = [];

    // First, collect all plugin manifests with their paths
    const allPluginData: ResolvedPlugin[] = [];

    const resolvedPath = path.resolve(PLUGIN_CONSTANTS.PLUGIN_DIRECTORY);

    if (!this.validateSearchPath(resolvedPath)) {
      return [];
    }

    const pluginDirs = this.getPluginDirectories(resolvedPath);
    const validPluginDirs = this.manifestValidator.discoverValidPluginDirs(resolvedPath, pluginDirs);

    this.collectPluginManifests(resolvedPath, validPluginDirs, allPluginData);

    // Filter out plugins with missing dependencies for graceful degradation
    const { loadablePlugins, dependencyErrors, excludedPlugins, structuredErrors, summary } = this.dependencyResolver.filterLoadablePluginsWithDetails(allPluginData);

    if (dependencyErrors.length > 0) {
      this.logger.warn('Plugin dependency issues detected:', dependencyErrors);

      // Log structured error details for better debugging
      if (structuredErrors.length > 0) {
        this.logger.warn('Detailed dependency analysis:');
        for (const error of structuredErrors) {
          this.logger.warn(`  - Plugin "${error.pluginName}" missing dependencies: [${error.missingDependencies.join(', ')}]`);
          if (error.affectedPlugins.length > 0) {
            this.logger.warn(`    This affects dependent plugins: [${error.affectedPlugins.join(', ')}]`);
          }
        }
      }

      // Log summary for quick overview
      this.logger.warn(`Plugin loading summary: ${summary.loadablePlugins}/${summary.totalPlugins} plugins loadable, ${summary.excludedPlugins} excluded`);

      if (excludedPlugins.length > 0) {
        this.logger.warn(`Excluding plugins: ${excludedPlugins.join(', ')}`);
      }
    }

    // If no plugins can be loaded, return empty array
    if (loadablePlugins.length === 0) {
      this.logger.error('No plugins can be loaded due to dependency failures');
      return [];
    }

    // Resolve loading order based on loadable plugins
    let sortedPlugins: ResolvedPlugin[] = [];
    try {
      sortedPlugins = this.dependencyResolver.resolveLoadingOrder(loadablePlugins);
      this.logger.log(`Resolved plugin loading order: ${sortedPlugins.map((p) => p.manifest.name).join(' -> ')}`);

      if (excludedPlugins.length > 0) {
        this.logger.log(`Successfully loading ${sortedPlugins.length} plugins despite ${excludedPlugins.length} excluded plugins`);
      }
    } catch (error) {
      this.logger.error('Failed to resolve plugin loading order for loadable plugins:', error);
      return []; // Return empty array if resolution fails
    }

    // Load plugins in dependency order
    this.loadPluginsInOrder(sortedPlugins, pluginModules);

    return pluginModules;
  }

  validateSearchPath(resolvedPath: string): boolean {
    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.LOG_MESSAGES.DISCOVERY.SEARCH_PATH_NOT_EXIST}: ${resolvedPath}`);
      return false;
    }
    return true;
  }

  getPluginDirectories(resolvedPath: string): string[] {
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
