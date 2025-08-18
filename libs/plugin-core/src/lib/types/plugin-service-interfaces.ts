import { Type } from '@nestjs/common';
import { PluginCoreAsyncConfig, PluginCoreConfig } from './plugin-core-config.interface';
import { PluginManifest } from './plugin-strict-interfaces';
import { PluginModuleResult } from './plugin-component-types';

/**
 * Interface for plugin discovery operations
 */
export interface IPluginDiscoveryService {
  discoverPluginModules(options: PluginCoreAsyncConfig): Type<any>[];
}

/**
 * Interface for plugin manifest validation operations
 */
export interface IPluginManifestValidator {
  validateManifest(manifest: unknown, pluginDir: string): manifest is PluginManifest;
  loadAndValidateManifest(manifestPath: string, pluginDir: string): PluginManifest | null;
  discoverValidPluginDirs(basePath: string, pluginDirs: string[]): string[];
}

/**
 * Interface for plugin module factory operations
 */
export interface IPluginModuleFactory {
  createPluginModule(manifest: PluginManifest, basePath: string, pluginDir: string): PluginModuleResult | null;
}

/**
 * Interface for plugin configuration validation
 */
export interface IPluginConfigValidator {
  validateAsyncConfig(options: PluginCoreAsyncConfig): boolean;
  validateConfig(config: PluginCoreConfig): boolean;
  sanitizeConfig(config: PluginCoreConfig): PluginCoreConfig;
}

/**
 * Interface for plugin component loading operations
 */
export interface IPluginComponentLoader {
  validateComponent(component: any, componentName: string): boolean;
  loadComponent(componentName: string, pluginDist: any): Type<any> | null;
}
