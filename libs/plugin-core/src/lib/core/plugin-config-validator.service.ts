import { Injectable, Logger } from '@nestjs/common';
import { PluginCoreConfig, PluginCoreAsyncConfig } from '../types/core/plugin-core-config.interface';
import { IPluginConfigValidator } from '../types/services/plugin-service-interfaces';
import { PLUGIN_CONSTANTS, PluginConstantsHelper } from '../constants';

@Injectable()
export class PluginConfigValidator implements IPluginConfigValidator {
  private readonly logger = new Logger(PluginConfigValidator.name);

  validateConfig(config: unknown): config is PluginCoreConfig {
    if (!config || typeof config !== 'object') {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.PLUGIN_CONFIG_MUST_BE_OBJECT);
      return false;
    }

    const configObj = config as Record<string, unknown>;

    // Validate optional boolean fields
    const booleanFields = PluginConstantsHelper.getBooleanFields();

    for (const field of booleanFields) {
      if (configObj[field] !== undefined && typeof configObj[field] !== 'boolean') {
        this.logger.warn(`Plugin config field ${field} ${PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.FIELD_MUST_BE_BOOLEAN}`);
        return false;
      }
    }

    // Validate optional numeric fields
    const numericFields = PluginConstantsHelper.getNumericFields();

    for (const field of numericFields) {
      if (configObj[field] !== undefined) {
        const value = configObj[field];
        if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
          this.logger.warn(`Plugin config field ${field} ${PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.FIELD_MUST_BE_NON_NEGATIVE_INTEGER}`);
          return false;
        }
      }
    }

    return true;
  }

  validateAsyncConfig(config: PluginCoreAsyncConfig): boolean {
    if (!config || typeof config !== 'object') {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.ASYNC_CONFIG_MUST_BE_OBJECT);
      return false;
    }

    // Must have exactly one of useFactory, useClass, or useExisting
    const configMethods = [config.useFactory, config.useClass, config.useExisting];
    const definedMethods = configMethods.filter((method) => method !== undefined);

    if (definedMethods.length !== 1) {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.EXACTLY_ONE_CONFIG_METHOD);
      return false;
    }

    // Validate useFactory
    if (config.useFactory && typeof config.useFactory !== 'function') {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.USE_FACTORY_MUST_BE_FUNCTION);
      return false;
    }

    // Validate inject array if present
    if (config.inject && !Array.isArray(config.inject)) {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.INJECT_MUST_BE_ARRAY);
      return false;
    }

    // Validate imports array if present
    if (config.imports && !Array.isArray(config.imports)) {
      this.logger.warn(PLUGIN_CONSTANTS.LOG_MESSAGES.CONFIG_VALIDATION.IMPORTS_MUST_BE_ARRAY);
      return false;
    }

    return true;
  }

  sanitizeConfig(config: PluginCoreConfig): PluginCoreConfig {
    return {
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
