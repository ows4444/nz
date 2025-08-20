import { Injectable, Logger, Optional } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { FieldProcessorRegistry } from '../../infrastructure/registries/field-processor.registry';
import { ClassConstructor } from '../../core/types/common.types';
import { LRUCache } from '../../infrastructure/cache/lru-cache';
import { CacheMonitorService } from '../../infrastructure/monitoring/cache-monitor.service';

@Injectable()
export class DtoGenerationPipeline {
  private readonly logger = new Logger(DtoGenerationPipeline.name);
  private readonly generatedClasses = new LRUCache<string, ClassConstructor<object>>(500); // Max 500 generated classes

  constructor(private readonly fieldProcessorRegistry: FieldProcessorRegistry, @Optional() private readonly cacheMonitor?: CacheMonitorService) {
    // Register cache for monitoring if service is available
    this.cacheMonitor?.registerCache('dto-generation-pipeline', this.generatedClasses);
  }

  generate(schema: DynamicSchemaEntity): ClassConstructor<object> {
    const cacheKey = this.generateOptimizedCacheKey(schema);

    // Check if already generated with improved cache key
    const cachedClass = this.generatedClasses.get(cacheKey);
    if (cachedClass) {
      this.logger.debug('Cache hit for DTO class', { cacheKey });
      return cachedClass;
    }

    const className = this.generateClassName(schema.name, schema.version.toString());
    const DynamicClass = this.generateWithRuntimeApproach(className, schema);

    // Cache the generated class with optimized key
    this.generatedClasses.set(cacheKey, DynamicClass);
    this.logger.debug('Generated and cached new DTO class', { className, cacheKey });

    // Log cache statistics if approaching capacity
    if (this.generatedClasses.isNearCapacity()) {
      const stats = this.generatedClasses.getStats();
      this.logger.warn('DTO generation cache approaching capacity', {
        ...stats,
        memoryUsageBytes: this.generatedClasses.getApproximateMemoryUsage(),
      });
    }

    return DynamicClass;
  }

  generateBatch(schemas: DynamicSchemaEntity[]): Map<string, ClassConstructor<object>> {
    const results = new Map<string, ClassConstructor<object>>();
    const uncachedSchemas: DynamicSchemaEntity[] = [];

    // First pass: check cache for all schemas
    for (const schema of schemas) {
      const cacheKey = this.generateOptimizedCacheKey(schema);
      const cachedClass = this.generatedClasses.get(cacheKey);

      if (cachedClass) {
        results.set(cacheKey, cachedClass);
      } else {
        uncachedSchemas.push(schema);
      }
    }

    // Second pass: generate missing DTOs in batch
    const startTime = Date.now();
    for (const schema of uncachedSchemas) {
      const cacheKey = this.generateOptimizedCacheKey(schema);
      const className = this.generateClassName(schema.name, schema.version.toString());

      try {
        const DynamicClass = this.generateWithRuntimeApproach(className, schema);
        this.generatedClasses.set(cacheKey, DynamicClass);
        results.set(cacheKey, DynamicClass);
      } catch (error) {
        this.logger.error('Failed to generate DTO in batch', {
          schema: schema.name,
          version: schema.version.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    const generationTime = Date.now() - startTime;
    this.logger.debug('Batch DTO generation completed', {
      totalSchemas: schemas.length,
      cacheHits: schemas.length - uncachedSchemas.length,
      generated: uncachedSchemas.length,
      generationTimeMs: generationTime,
    });

    return results;
  }

  private generateWithRuntimeApproach(className: string, schema: DynamicSchemaEntity): ClassConstructor<object> {
    const DynamicClass = this.createBaseClass(className, schema);

    // Process each field
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      try {
        const processor = this.fieldProcessorRegistry.getProcessor(fieldSchema.type);
        const isRequired = schema.getRequiredFields().includes(fieldName);

        const decorators = [
          ...processor.generateValidationDecorators(fieldSchema, isRequired, false),
          ...processor.generateTransformationDecorators(fieldSchema),
          ...processor.generateSerializationDecorators(fieldSchema, isRequired, schema.excludeAll),
        ];

        this.applyDecorators(DynamicClass, fieldName, decorators);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to process field ${fieldName}`, {
          fieldName,
          fieldType: fieldSchema.type,
          error: errorMessage,
        });
        throw new Error(`Field processing failed for ${fieldName}: ${errorMessage}`);
      }
    }

    // Apply class-level decorators
    if (schema.excludeAll) {
      Exclude()(DynamicClass);
    }

    return DynamicClass;
  }

  private createBaseClass(className: string, schema: DynamicSchemaEntity): ClassConstructor<object> {
    const DynamicClass = function (this: Record<string, unknown>) {
      for (const propName of Object.keys(schema.properties)) {
        this[propName] = undefined;
      }
    } as unknown as ClassConstructor<object>;

    Object.defineProperty(DynamicClass, 'name', { value: className });
    return DynamicClass;
  }

  private generateClassName(name: string, version: string): string {
    return `${name}_v${version.replace(/\./g, '_')}`;
  }

  private generateOptimizedCacheKey(schema: DynamicSchemaEntity): string {
    // Create a more efficient cache key that includes schema structure hash
    const fieldsHash = this.generateFieldsHash(schema);
    const versionString = schema.version.toString();
    return `${schema.name}:${versionString}:${fieldsHash}`;
  }

  private generateFieldsHash(schema: DynamicSchemaEntity): string {
    // Generate a hash based on field structure for better cache differentiation
    const fieldSignature = Object.entries(schema.properties)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
      .map(([fieldName, fieldSchema]) => {
        const isRequired = schema.getRequiredFields().includes(fieldName);
        return `${fieldName}:${fieldSchema.type}:${isRequired}`;
      })
      .join('|');

    // Simple hash function for field signature
    let hash = 0;
    for (let i = 0; i < fieldSignature.length; i++) {
      const char = fieldSignature.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  private applyDecorators(targetClass: ClassConstructor<object>, propertyName: string, decorators: PropertyDecorator[]): void {
    decorators.forEach((decorator) => {
      if (typeof decorator === 'function') {
        decorator(targetClass.prototype, propertyName);
      }
    });
  }
}
