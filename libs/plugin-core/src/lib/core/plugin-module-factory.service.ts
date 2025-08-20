import { createRequire } from 'module';
import { Injectable, Logger, Module, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { Plugin } from '../types/core/plugin-core-config.interface';
import { PluginManifest } from '../types/core/plugin-strict-interfaces';
import { PluginModuleResult, ComponentLoadingContext, PluginModuleComponents } from '../types/components/plugin-component-types';
import { IPluginModuleFactory } from '../types/services/plugin-service-interfaces';
import { PluginComponentLoaderService } from './plugin-component-loader.service';
import { PluginUtilityService } from './plugin-utility.service';
import { PLUGIN_CONSTANTS } from '../constants';

@Injectable()
export class PluginModuleFactory implements IPluginModuleFactory {
  private readonly logger = new Logger(PluginModuleFactory.name);
  private readonly require = createRequire(__filename);

  createPluginModule(manifest: PluginManifest, basePath: string, pluginDir: string): PluginModuleResult | null {
    if (!this.validateInputs(manifest, basePath, pluginDir)) {
      return null;
    }

    try {
      const context = this.createLoadingContext(manifest, basePath, pluginDir);
      if (!context) {
        return null;
      }

      const components = PluginComponentLoaderService.loadAllComponents(context);
      if (!PluginComponentLoaderService.hasValidComponents(components)) {
        this.logger.warn(`No valid components found for plugin ${manifest.name}`);
        return null;
      }

      const dynamicModule = this.createDynamicModule(manifest, components);
      this.logger.log(`${PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.PLUGIN_LOADED}: ${manifest.name}`);

      return {
        module: dynamicModule,
        components,
        manifest,
      };
    } catch (error) {
      this.logger.error(`Failed to create plugin module for ${manifest?.name || 'unknown'}:`, error);
      return null;
    }
  }

  static createPluginModule(manifest: PluginManifest, basePath: string, pluginDir: string): PluginModuleResult | null {
    const instance = new PluginModuleFactory();
    return instance.createPluginModule(manifest, basePath, pluginDir);
  }

  private validateInputs(manifest: PluginManifest, basePath: string, pluginDir: string): boolean {
    if (!manifest?.name || !manifest?.module) {
      this.logger.warn('Invalid manifest: missing name or module');
      return false;
    }

    if (!basePath || !pluginDir) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_PARAMETERS}: basePath and pluginDir are required`);
      return false;
    }

    return true;
  }

  private createLoadingContext(manifest: PluginManifest, basePath: string, pluginDir: string): ComponentLoadingContext | null {
    const distPath = path.join(basePath, pluginDir, PLUGIN_CONSTANTS.DIST_DIRECTORY);

    if (!fs.existsSync(distPath)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.DIST_NOT_FOUND} for plugin ${manifest.name} at ${distPath}`);
      return null;
    }

    try {
      const pluginDist = this.require(distPath);
      return {
        manifest,
        pluginDist,
        basePath,
        pluginDir,
      };
    } catch (error) {
      this.logger.error(`Failed to load plugin distribution for ${manifest.name}:`, error);
      return null;
    }
  }

  private createDynamicModule(manifest: PluginManifest, components: PluginModuleComponents): Type<any> {
    const pluginName = PluginUtilityService.generatePluginName(manifest.name);
    const moduleName = PluginUtilityService.generateModuleName(pluginName);
    const pluginIdentifier = PluginUtilityService.generatePluginIdentifier(pluginName);

    const DynamicPluginModule = class {};
    Object.defineProperty(DynamicPluginModule, 'name', {
      value: moduleName,
      writable: false,
      enumerable: false,
      configurable: true,
    });

    Plugin({
      name: pluginIdentifier,
      enabled: false,
    })(DynamicPluginModule);

    Module({
      imports: [DiscoveryModule],
      controllers: components.controllers,
      providers: components.providers,
      exports: components.exports,
    })(DynamicPluginModule);

    return DynamicPluginModule as Type<any>;
  }
}
