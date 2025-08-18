import { Logger } from '@nestjs/common';
import { PLUGIN_CONSTANTS } from '../constants';

/**
 * Utility service for common plugin operations
 */
export class PluginUtilityService {
  private static readonly logger = new Logger(PluginUtilityService.name);

  /**
   * Generate a standardized plugin name from manifest name
   */
  static generatePluginName(manifestName: string): string {
    if (!manifestName || typeof manifestName !== 'string') {
      throw new Error(`${PLUGIN_CONSTANTS.ERRORS.INVALID_PARAMETERS}: manifestName must be a non-empty string`);
    }

    return manifestName
      .replace(PLUGIN_CONSTANTS.PLUGIN_PREFIX_PATTERN, '')
      .replace(/^[a-z]/, (c: string) => c.toUpperCase())
      .replace(/-/g, '');
  }

  /**
   * Generate module name from plugin name
   */
  static generateModuleName(pluginName: string): string {
    return `${pluginName}${PLUGIN_CONSTANTS.MODULE_SUFFIX}`;
  }

  /**
   * Generate plugin identifier from manifest name
   */
  static generatePluginIdentifier(pluginName: string): string {
    return `${pluginName}${PLUGIN_CONSTANTS.PLUGIN_SUFFIX}`;
  }

  /**
   * Validate plugin name according to conventions
   */
  static validatePluginName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    const length = name.length;
    return length >= PLUGIN_CONSTANTS.MIN_PLUGIN_NAME_LENGTH && length <= PLUGIN_CONSTANTS.MAX_PLUGIN_NAME_LENGTH;
  }

  /**
   * Sanitize plugin name for safe usage
   */
  static sanitizePluginName(name: string): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  /**
   * Extract plugin name from file path
   */
  static extractPluginNameFromPath(pluginPath: string): string {
    if (!pluginPath) {
      return '';
    }

    const parts = pluginPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  /**
   * Check if a value is a valid plugin instance
   */
  static isValidPluginInstance(value: any): boolean {
    return value !== null && value !== undefined && typeof value === 'object';
  }

  /**
   * Deep clone plugin configuration
   */
  static clonePluginConfig<T>(config: T): T {
    try {
      return JSON.parse(JSON.stringify(config));
    } catch (error) {
      this.logger.warn('Failed to clone plugin config, returning original');
      return config;
    }
  }

  /**
   * Measure execution time of a function
   */
  static async measureExecutionTime<T>(operation: () => Promise<T> | T, operationName: string): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      this.logger.debug(`${operationName} completed in ${duration.toFixed(2)}ms`);

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.logger.error(`${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Create a deterministic hash from a string (simple implementation)
   */
  static createSimpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
