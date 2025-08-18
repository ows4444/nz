import { Logger, Type } from '@nestjs/common';
import { PluginModuleComponents, ComponentLoader, ComponentLoadingContext, PluginComponentType } from '../types/plugin-component-types';
import { PLUGIN_CONSTANTS } from '../constants';

export class PluginComponentLoaderService implements ComponentLoader {
  private static readonly logger = new Logger(PluginComponentLoaderService.name);

  validateComponent(component: any, componentName: string): boolean {
    return PluginComponentLoaderService.validateComponent(component, componentName);
  }

  loadComponent(componentName: string, pluginDist: any): Type<any> | null {
    return PluginComponentLoaderService.loadSingleComponentFromDist(componentName, pluginDist);
  }

  static loadAllComponents(context: ComponentLoadingContext): PluginModuleComponents {
    const components: PluginModuleComponents = {
      controllers: [],
      providers: [],
      exports: [],
    };

    this.loadComponentsOfType('controllers', context, components);
    this.loadComponentsOfType('providers', context, components);
    this.loadComponentsOfType('exports', context, components);

    return components;
  }

  private static loadComponentsOfType(type: PluginComponentType, context: ComponentLoadingContext, components: PluginModuleComponents): void {
    const componentNames = context.manifest.module[type];
    if (!Array.isArray(componentNames)) {
      return;
    }

    for (const componentName of componentNames) {
      const component = this.loadSingleComponent(componentName, context, type);
      if (component) {
        components[type].push(component);
      }
    }
  }

  private static loadSingleComponent(componentName: string, context: ComponentLoadingContext, type: PluginComponentType): Type<any> | null {
    if (!componentName || typeof componentName !== 'string') {
      this.logger.warn(`Invalid component name for ${type} in ${context.manifest.name}: ${componentName}`);
      return null;
    }

    const component = context.pluginDist[componentName];
    if (!component) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.COMPONENT_NOT_FOUND}: ${type.slice(0, -1)} ${componentName} in ${context.manifest.name}`);
      return null;
    }

    if (!PluginComponentLoaderService.validateComponent(component, componentName)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_COMPONENT} ${componentName} in ${context.manifest.name}`);
      return null;
    }

    this.logger.debug(`Loaded ${type.slice(0, -1)}: ${componentName} from ${context.manifest.name}`);
    return component;
  }

  static loadSingleComponentFromDist(componentName: string, pluginDist: any): Type<any> | null {
    if (!componentName || !pluginDist) {
      return null;
    }

    const component = pluginDist[componentName];
    return this.validateComponent(component, componentName) ? component : null;
  }

  static validateComponent(component: any, componentName: string): boolean {
    if (!component) {
      return false;
    }

    // Check if it's a class/constructor function
    if (typeof component !== 'function') {
      PluginComponentLoaderService.logger.warn(`Component ${componentName} is not a constructor function`);
      return false;
    }

    return true;
  }

  static hasValidComponents(components: PluginModuleComponents): boolean {
    return components.controllers.length > 0 || components.providers.length > 0 || components.exports.length > 0;
  }
}
