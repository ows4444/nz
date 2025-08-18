import { Injectable, Logger } from '@nestjs/common';
import { PluginCoreConfig, PluginCoreAsyncConfig } from '../types/plugin-core-config.interface';
import { IPluginConfigValidator } from '../types/plugin-service-interfaces';
import { PLUGIN_CONSTANTS } from '../constants';

@Injectable()
export class PluginConfigValidator implements IPluginConfigValidator {
  private readonly logger = new Logger(PluginConfigValidator.name);

  validateConfig(config: unknown): config is PluginCoreConfig {
    if (!config || typeof config !== 'object') {
      this.logger.warn('Plugin config must be an object');
      return false;
    }

    const configObj = config as Record<string, unknown>;

    // Validate required searchPaths
    if (!configObj.searchPaths || !Array.isArray(configObj.searchPaths)) {
      this.logger.warn('Plugin config must have searchPaths as an array');
      return false;
    }

    if (configObj.searchPaths.length === 0) {
      this.logger.warn('Plugin config searchPaths cannot be empty');
      return false;
    }

    // Validate searchPaths contain only strings
    for (const path of configObj.searchPaths) {
      if (typeof path !== 'string' || path.trim().length === 0) {
        this.logger.warn(`Invalid search path: ${path}`);
        return false;
      }
    }

    // Validate optional boolean fields
    const booleanFields = ['autoStart', 'enableMemoryMonitoring', 'parallelLoading', 'enableHotReload', 'cacheEnabled', 'skipRuntimeLoading'];

    for (const field of booleanFields) {
      if (configObj[field] !== undefined && typeof configObj[field] !== 'boolean') {
        this.logger.warn(`Plugin config field ${field} must be a boolean`);
        return false;
      }
    }

    // Validate optional numeric fields
    const numericFields = ['defaultTimeout', 'defaultRetries', 'maxConcurrentLoads'];

    for (const field of numericFields) {
      if (configObj[field] !== undefined) {
        const value = configObj[field];
        if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
          this.logger.warn(`Plugin config field ${field} must be a non-negative integer`);
          return false;
        }
      }
    }

    return true;
  }

  validateAsyncConfig(config: PluginCoreAsyncConfig): boolean {
    if (!config || typeof config !== 'object') {
      this.logger.warn('Plugin async config must be an object');
      return false;
    }

    // Must have exactly one of useFactory, useClass, or useExisting
    const configMethods = [config.useFactory, config.useClass, config.useExisting];
    const definedMethods = configMethods.filter((method) => method !== undefined);

    if (definedMethods.length !== 1) {
      this.logger.warn('Plugin async config must have exactly one of: useFactory, useClass, or useExisting');
      return false;
    }

    // Validate useFactory
    if (config.useFactory && typeof config.useFactory !== 'function') {
      this.logger.warn('Plugin async config useFactory must be a function');
      return false;
    }

    // Validate inject array if present
    if (config.inject && !Array.isArray(config.inject)) {
      this.logger.warn('Plugin async config inject must be an array');
      return false;
    }

    // Validate imports array if present
    if (config.imports && !Array.isArray(config.imports)) {
      this.logger.warn('Plugin async config imports must be an array');
      return false;
    }

    return true;
  }

  sanitizeConfig(config: PluginCoreConfig): PluginCoreConfig {
    return {
      searchPaths: [...config.searchPaths], // Copy array
      autoStart: config.autoStart ?? true,
      enableMemoryMonitoring: config.enableMemoryMonitoring ?? false,
      defaultTimeout: config.defaultTimeout ?? PLUGIN_CONSTANTS.DEFAULT_TIMEOUT,
      defaultRetries: config.defaultRetries ?? PLUGIN_CONSTANTS.DEFAULT_RETRIES,
      parallelLoading: config.parallelLoading ?? false,
      maxConcurrentLoads: config.maxConcurrentLoads ?? PLUGIN_CONSTANTS.DEFAULT_MAX_CONCURRENT_LOADS,
      enableHotReload: config.enableHotReload ?? false,
      cacheEnabled: config.cacheEnabled ?? true,
      skipRuntimeLoading: config.skipRuntimeLoading ?? false,
      securityConfig: config.securityConfig,
      resourceLimits: config.resourceLimits,
      logging: config.logging,
    };
  }

  // Static methods for backward compatibility
  static validateConfig(config: unknown): config is PluginCoreConfig {
    const instance = new PluginConfigValidator();
    return instance.validateConfig(config);
  }

  static validateAsyncConfig(config: PluginCoreAsyncConfig): boolean {
    const instance = new PluginConfigValidator();
    return instance.validateAsyncConfig(config);
  }

  static sanitizeConfig(config: PluginCoreConfig): PluginCoreConfig {
    const instance = new PluginConfigValidator();
    return instance.sanitizeConfig(config);
  }
}
