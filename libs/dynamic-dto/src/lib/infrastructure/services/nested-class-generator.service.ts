import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { FieldSchema } from '../../core/interfaces/schema';
import { classConstructor } from '../../core/types/common.types';
import { LRUCache } from '../cache/lru-cache';
import { CacheMonitorService } from '../monitoring/cache-monitor.service';
import { isClassConstructor, isSchemaRecord, isStringArray } from '../../core/types/type-guards';
import type { FieldProcessorRegistry } from '../registries/field-processor.registry';

export interface INestedClassGenerator {
  generateNestedClass<T extends Record<string, FieldSchema>>(properties: T, required?: string[], exclude?: boolean): classConstructor<{ [K in keyof T]: unknown }>;
}

@Injectable()
export class NestedClassGeneratorService implements INestedClassGenerator {
  private readonly logger = new Logger(NestedClassGeneratorService.name);
  private readonly generatedClasses = new LRUCache<string, classConstructor<any>>(300); // Max 300 nested classes
  private classCounter = 0;

  constructor(
    @Inject(forwardRef(() => 'FieldProcessorRegistry'))
    private readonly fieldProcessorRegistry: FieldProcessorRegistry,
    @Optional() private readonly cacheMonitor?: CacheMonitorService
  ) {
    // Register cache for monitoring if service is available
    this.cacheMonitor?.registerCache('nested-class-generator', this.generatedClasses);
  }

  generateNestedClass<T extends Record<string, FieldSchema>>(properties: T, required: string[] = [], exclude = false): classConstructor<{ [K in keyof T]: unknown }> {
    // Type validation
    if (!isSchemaRecord(properties)) {
      throw new Error('Invalid properties: must be a record of field schemas');
    }

    if (!isStringArray(required)) {
      throw new Error('Invalid required array: must be an array of strings');
    }
    const cacheKey = this.generateCacheKey(properties, required, exclude);

    const cachedClass = this.generatedClasses.get(cacheKey);
    if (cachedClass) {
      return cachedClass as classConstructor<{ [K in keyof T]: unknown }>;
    }

    const className = this.generateUniqueClassName();
    const DynamicClass = this.createBaseClass(className, properties);

    // Process each field
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      try {
        const isRequired = required.includes(fieldName);
        const decorators = this.fieldProcessorRegistry.processField(fieldSchema, isRequired, false);

        this.applyDecorators(DynamicClass, fieldName, decorators);
      } catch (error) {
        this.logger.error(`Failed to process nested field ${fieldName}`, {
          fieldName,
          fieldType: fieldSchema.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`Nested field processing failed for ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (exclude) {
      Exclude()(DynamicClass);
    }

    this.generatedClasses.set(cacheKey, DynamicClass);

    // Log cache statistics if approaching capacity
    if (this.generatedClasses.isNearCapacity()) {
      const stats = this.generatedClasses.getStats();
      this.logger.warn('Nested class generation cache approaching capacity', {
        ...stats,
        memoryUsageBytes: this.generatedClasses.getApproximateMemoryUsage(),
      });
    }

    return DynamicClass as classConstructor<{ [K in keyof T]: unknown }>;
  }

  private createBaseClass<T extends Record<string, FieldSchema>>(className: string, properties: T): classConstructor<{ [K in keyof T]: unknown }> {
    const DynamicClass = function (this: { [K in keyof T]: unknown }) {
      for (const propName of Object.keys(properties)) {
        this[propName as keyof T] = undefined;
      }
    } as unknown as classConstructor<{ [K in keyof T]: unknown }>;

    Object.defineProperty(DynamicClass, 'name', { value: className });

    // Type assertion to ensure class constructor is properly typed
    if (!isClassConstructor(DynamicClass)) {
      throw new Error(`Failed to create valid class constructor for ${className}`);
    }

    return DynamicClass;
  }

  private generateUniqueClassName(): string {
    return `DynamicNested${++this.classCounter}_${Date.now()}`;
  }

  private generateCacheKey(properties: Record<string, FieldSchema>, required: string[], exclude: boolean): string {
    // Use hash-based cache key generation instead of expensive JSON.stringify
    const propertiesHash = this.hashObject(properties);
    const requiredHash = this.hashArray(required);
    return `${propertiesHash}:${requiredHash}:${exclude}`;
  }

  private hashObject(obj: Record<string, FieldSchema>): string {
    const keys = Object.keys(obj).sort();
    let hash = '';
    for (const key of keys) {
      const field = obj[key];
      if (field?.type) {
        hash += `${key}:${field.type}:${field.nullable ?? false}:${field.exclude ?? false};`;
      }
    }
    return this.simpleHash(hash);
  }

  private hashArray(arr: string[]): string {
    return this.simpleHash(arr.sort().join(','));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private applyDecorators<T extends Record<string, FieldSchema>>(targetClass: classConstructor<{ [K in keyof T]: unknown }>, propertyName: string, decorators: PropertyDecorator[]): void {
    if (!Array.isArray(decorators)) {
      this.logger.error(`Invalid decorators format for field ${propertyName}`, {
        decorators,
        typeof: typeof decorators,
        isArray: Array.isArray(decorators),
      });
      throw new Error('Decorators must be an array');
    }

    decorators.forEach((decorator, index) => {
      if (typeof decorator !== 'function') {
        this.logger.error(`Invalid decorator at index ${index} for field ${propertyName}`, {
          decorator,
          typeof: typeof decorator,
        });
        throw new Error(`Invalid decorator: expected function, got ${typeof decorator}`);
      }
      try {
        decorator(targetClass.prototype, propertyName);
      } catch (error) {
        this.logger.error(`Failed to apply decorator ${index} to field ${propertyName}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }
}
