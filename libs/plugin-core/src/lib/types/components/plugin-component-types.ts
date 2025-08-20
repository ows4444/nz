/**
 * Strong typing for plugin components and modules
 */

import { Type } from '@nestjs/common';
import { PluginManifest } from '../core/plugin-strict-interfaces';

export interface PluginComponent {
  name: string;
  type: 'controller' | 'provider' | 'export';
  class: Type<any>;
}

export interface PluginModuleComponents {
  controllers: Type<any>[];
  providers: Type<any>[];
  exports: Type<any>[];
}

export interface PluginModuleResult {
  module: Type<any>;
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
  loadComponent(componentName: string, pluginDist: any): Type<any> | null;
  validateComponent(component: any, componentName: string): boolean;
}

export type PluginComponentType = 'controllers' | 'providers' | 'exports';

export interface ComponentLoadingContext {
  manifest: PluginManifest;
  pluginDist: any;
  basePath: string;
  pluginDir: string;
}
