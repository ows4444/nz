import { Injectable, Logger, Type } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PluginCoreAsyncConfig, PluginCoreConfig } from '../types';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PLUGIN_CONSTANTS } from '../constants';

@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);

  constructor(private readonly manifestValidator: PluginManifestValidator, private readonly moduleFactory: PluginModuleFactory, private readonly configValidator: PluginConfigValidator) {}

  discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    if (!this.configValidator.validateAsyncConfig(options)) {
      this.logger.warn('Invalid async configuration provided');
      return [];
    }

    try {
      const pluginOptions = this.getPluginOptionsSync(options);

      if (!pluginOptions) {
        this.logger.warn('Cannot pre-discover plugin modules for async factory functions');
        return [];
      }

      if (pluginOptions.skipRuntimeLoading) {
        this.logger.log('Skipping runtime plugin loading as configured');
        return [];
      }

      return this.loadPluginModulesFromSearchPaths(pluginOptions);
    } catch (error) {
      this.logger.error('Could not pre-discover plugin modules:', error);
      return [];
    }
  }

  static discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[] {
    // Legacy static method for backward compatibility
    const instance = new PluginDiscoveryService(new PluginManifestValidator(), new PluginModuleFactory(), new PluginConfigValidator());
    return instance.discoverPluginModules(options);
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

    for (const searchPath of Array.from(pluginOptions.searchPaths)) {
      const resolvedPath = path.resolve(searchPath);

      if (!this.validateSearchPath(resolvedPath)) {
        continue;
      }

      const pluginDirs = this.getPluginDirectories(resolvedPath);
      const validPluginDirs = this.manifestValidator.discoverValidPluginDirs(resolvedPath, pluginDirs);

      this.loadPluginsFromDirectories(resolvedPath, validPluginDirs, pluginModules);
    }

    return pluginModules;
  }

  private validateSearchPath(resolvedPath: string): boolean {
    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(`Search path does not exist: ${resolvedPath}`);
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

  private loadPluginsFromDirectories(resolvedPath: string, pluginDirs: string[], pluginModules: Type<any>[]): void {
    for (const pluginDir of pluginDirs) {
      try {
        const manifestPath = path.join(resolvedPath, pluginDir, PLUGIN_CONSTANTS.MANIFEST_FILE);
        const manifest = this.manifestValidator.loadAndValidateManifest(manifestPath, pluginDir);

        if (manifest) {
          const pluginModule = this.moduleFactory.createPluginModule(manifest, resolvedPath, pluginDir);
          if (pluginModule) {
            pluginModules.push(pluginModule.module);
            this.logger.log(`${PLUGIN_CONSTANTS.MESSAGES.PLUGIN_LOADED}: ${manifest.name}`);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to process plugin ${pluginDir}:`, error);
      }
    }
  }
}
