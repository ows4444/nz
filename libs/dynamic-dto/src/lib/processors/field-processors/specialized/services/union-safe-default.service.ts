import { Injectable } from '@nestjs/common';
import { FieldType } from '../../../../core/types/field.types';
import type { FieldSchema } from '../../../../core/interfaces/schema';
import { UnionFieldSchema } from '../../../../core/interfaces/schema/specialized-primitives/union-field.schema';

/**
 * Safe default value configuration for computed defaults
 */
interface SafeComputedDefaultConfig {
  readonly type: 'first' | 'preferred' | 'computed';
  readonly typeIndex?: number;
  readonly value?: unknown;
  readonly strategy?: 'static' | 'timestamp' | 'random' | 'type_based';
  readonly options?: Record<string, unknown>;
}

/**
 * Service responsible for generating safe default values for union types.
 * Removes the security vulnerability from expression evaluation by using
 * predefined strategies instead of dynamic code execution.
 */
@Injectable()
export class UnionSafeDefaultService {
  /**
   * Gets a default value for a union field based on configuration
   * @param schema The union schema
   * @returns The computed default value
   */
  getDefaultValue(schema: UnionFieldSchema): unknown {
    if (schema.default === undefined) {
      return undefined;
    }

    // Handle simple default values
    if (typeof schema.default !== 'object' || schema.default === null) {
      return schema.default;
    }

    // Handle complex default configuration
    const defaultConfig = schema.default as SafeComputedDefaultConfig;
    return this.evaluateDefaultConfig(defaultConfig, schema);
  }

  /**
   * Gets a default value for a specific union type
   * @param typeSchema The specific type schema
   * @returns Default value for the type
   */
  getDefaultValueForType(typeSchema: FieldSchema): unknown {
    switch (typeSchema.type) {
      case FieldType.string:
        return '';
      case FieldType.number:
        return 0;
      case FieldType.boolean:
        return false;
      case FieldType.array:
        return [];
      case FieldType.object:
        return {};
      case FieldType.date:
        return new Date().toISOString();
      default:
        return null;
    }
  }

  /**
   * Evaluates a default configuration safely without code execution
   * @param config The default configuration
   * @param schema The union schema
   * @returns The computed default value
   */
  private evaluateDefaultConfig(config: SafeComputedDefaultConfig, schema: UnionFieldSchema): unknown {
    switch (config.type) {
      case 'first':
        return this.getDefaultValueForType(schema.unionTypes[0] as FieldSchema);

      case 'preferred':
        return this.evaluatePreferredDefault(config, schema);

      case 'computed':
        return this.evaluateComputedDefault(config, schema);

      default:
        return this.getDefaultValueForType(schema.unionTypes[0] as FieldSchema);
    }
  }

  /**
   * Evaluates preferred default strategy
   * @param config The default configuration
   * @param schema The union schema
   * @returns The preferred default value
   */
  private evaluatePreferredDefault(config: SafeComputedDefaultConfig, schema: UnionFieldSchema): unknown {
    if (config.typeIndex !== undefined) {
      const typeIndex = config.typeIndex;
      if (typeIndex >= 0 && typeIndex < schema.unionTypes.length) {
        return this.getDefaultValueForType(schema.unionTypes[typeIndex] as FieldSchema);
      }
    }

    if (config.value !== undefined) {
      return config.value;
    }

    return this.getDefaultValueForType(schema.unionTypes[0] as FieldSchema);
  }

  /**
   * Evaluates computed default using safe predefined strategies
   * @param config The default configuration
   * @param schema The union schema
   * @returns The computed default value
   */
  private evaluateComputedDefault(config: SafeComputedDefaultConfig, schema: UnionFieldSchema): unknown {
    const strategy = config.strategy ?? 'static';

    switch (strategy) {
      case 'static':
        return config.value ?? this.getDefaultValueForType(schema.unionTypes[0] as FieldSchema);

      case 'timestamp':
        return this.generateTimestampDefault(config.options);

      case 'random':
        return this.generateRandomDefault(config.options, schema);

      case 'type_based':
        return this.generateTypeBasedDefault(config.options, schema);

      default:
        return this.getDefaultValueForType(schema.unionTypes[0] as FieldSchema);
    }
  }

  /**
   * Generates timestamp-based default values
   * @param options Configuration options
   * @returns Timestamp-based default value
   */
  private generateTimestampDefault(options?: Record<string, unknown>): unknown {
    const format = (options?.format as string) ?? 'iso';
    const now = new Date();

    switch (format) {
      case 'iso':
        return now.toISOString();
      case 'unix':
        return Math.floor(now.getTime() / 1000);
      case 'milliseconds':
        return now.getTime();
      case 'date_only':
        return now.toISOString().split('T')[0];
      default:
        return now.toISOString();
    }
  }

  /**
   * Generates random default values safely
   * @param options Configuration options
   * @param schema The union schema
   * @returns Random default value
   */
  private generateRandomDefault(options?: Record<string, unknown>, schema?: UnionFieldSchema): unknown {
    const type = (options?.type as string) ?? 'choice';

    switch (type) {
      case 'choice':
        if (schema && schema.unionTypes.length > 0) {
          const randomIndex = Math.floor(Math.random() * schema.unionTypes.length);
          return this.getDefaultValueForType(schema.unionTypes[randomIndex] as FieldSchema);
        }
        return null;

      case 'integer': {
        const max = (options?.max as number) ?? 100;
        const min = (options?.min as number) ?? 0;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      case 'string': {
        const length = (options?.length as number) ?? 8;
        return this.generateRandomString(length);
      }

      case 'boolean':
        return Math.random() < 0.5;

      default:
        return null;
    }
  }

  /**
   * Generates type-based default values
   * @param options Configuration options
   * @param schema The union schema
   * @returns Type-based default value
   */
  private generateTypeBasedDefault(options?: Record<string, unknown>, schema?: UnionFieldSchema): unknown {
    const preferredTypes = (options?.preferredTypes as string[]) ?? [];

    if (schema && preferredTypes.length > 0) {
      // Find first matching type in preference order
      for (const preferredType of preferredTypes) {
        const typeIndex = schema.unionTypes.findIndex((type) => (type as FieldSchema).type === preferredType);

        if (typeIndex >= 0) {
          return this.getDefaultValueForType(schema.unionTypes[typeIndex] as FieldSchema);
        }
      }
    }

    // Fall back to first type if no preferred type matches
    return schema ? this.getDefaultValueForType(schema.unionTypes[0] as FieldSchema) : null;
  }

  /**
   * Generates a random string of specified length
   * @param length The desired string length
   * @returns Random string
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * Validates if a default configuration is safe
   * @param defaultConfig The default configuration to validate
   * @returns True if the configuration is safe
   */
  isSafeDefaultConfig(defaultConfig: unknown): boolean {
    if (typeof defaultConfig !== 'object' || defaultConfig === null) {
      return true; // Simple values are always safe
    }

    const config = defaultConfig as SafeComputedDefaultConfig;

    // Check for allowed types
    const allowedTypes = ['first', 'preferred', 'computed'];
    if (!allowedTypes.includes(config.type)) {
      return false;
    }

    // Check for allowed strategies
    if (config.type === 'computed') {
      const allowedStrategies = ['static', 'timestamp', 'random', 'type_based'];
      const strategy = config.strategy ?? 'static';
      if (!allowedStrategies.includes(strategy)) {
        return false;
      }
    }

    return true;
  }
}
