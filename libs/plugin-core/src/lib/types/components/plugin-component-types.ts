/**
 * Strong typing for plugin components and modules
 */

import { Type } from '@nestjs/common';
import { PluginManifest } from '../core/plugin-strict-interfaces';

/**
 * Base interface for plugin component instance types
 */
export interface PluginComponentInstance {
  [key: string]: unknown;
}

/**
 * Plugin distribution interface for loaded modules
 */
export interface PluginDistribution {
  [componentName: string]: Type<PluginComponentInstance>;
}

export interface PluginComponent<T extends PluginComponentInstance = PluginComponentInstance> {
  name: string;
  type: 'controller' | 'provider' | 'export';
  class: Type<T>;
}

export interface PluginModuleComponents {
  controllers: Type<PluginComponentInstance>[];
  providers: Type<PluginComponentInstance>[];
  exports: Type<PluginComponentInstance>[];
}

export interface PluginModuleResult {
  module: Type<PluginComponentInstance>;
  components: PluginModuleComponents;
  manifest: PluginManifest;
}

export interface PluginLoadingResult {
  success: boolean;
  pluginName: string;
  error?: string;
  components?: PluginModuleComponents;
}

export interface ComponentLoader {
  loadComponent<T extends PluginComponentInstance = PluginComponentInstance>(
    componentName: string, 
    pluginDist: PluginDistribution
  ): Type<T> | null;
  validateComponent<T extends PluginComponentInstance = PluginComponentInstance>(
    component: Type<T>, 
    componentName: string
  ): boolean;
}

export type PluginComponentType = 'controllers' | 'providers' | 'exports';

export interface ComponentLoadingContext {
  manifest: PluginManifest;
  pluginDist: PluginDistribution;
  basePath: string;
  pluginDir: string;
}
