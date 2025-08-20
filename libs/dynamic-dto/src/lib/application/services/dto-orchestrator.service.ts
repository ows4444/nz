import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { ICacheManager } from '../../core/interfaces/cache/cache-manager.interface';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { DtoGenerationPipeline } from '../pipelines/dto-generation.pipeline';
import { ValidationPipeline } from '../pipelines/validation.pipeline';
import type { ClassConstructor } from '../../core/types/common.types';
import { MODULE_OPTIONS_TOKEN } from '../../dynamic-dto.module-definition';
import type { DynamicDtoModuleOptions } from '../../interfaces/module-options.interface';

@Injectable()
export class DtoOrchestratorService {
  private readonly logger = new Logger(DtoOrchestratorService.name);

  constructor(
    private readonly validationPipeline: ValidationPipeline,
    private readonly generationPipeline: DtoGenerationPipeline,
    @Inject('ICacheManager') private readonly cacheManager: ICacheManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: DynamicDtoModuleOptions
  ) {}

  async generateDto(schema: DynamicSchemaEntity): Promise<ClassConstructor<object>> {
    const startTime = Date.now();

    try {
      // Check memory usage before proceeding with expensive operations
      const memoryExceeded = await this.cacheManager.isMemoryThresholdExceeded();
      if (memoryExceeded) {
        this.logger.warn('Cache memory threshold exceeded, performing cleanup before DTO generation');
        await this.cacheManager.cleanup(false);
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(schema);

      // Check cache first
      const cached = await this.cacheManager.get<ClassConstructor<object>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Validate schema
      const validationResult = this.validationPipeline.validate(schema);
      if (!validationResult.isValid) {
        this.logger.error('Schema validation failed', {
          schemaId: schema.id,
          errors: validationResult.errors,
        });
        throw new Error(`Schema validation failed: ${JSON.stringify(validationResult.errors)}`);
      }

      // Generate DTO
      const generatedClass = this.generationPipeline.generate(schema);

      // Cache result with adaptive TTL based on memory usage
      const memoryInfo = await this.cacheManager.getMemoryUsage();
      const baseTtl = this.options.cache?.ttl ?? 3600; // 1 hour default
      
      // Reduce TTL if memory utilization is high
      const adaptiveTtl = memoryInfo.utilizationRate > 0.8 
        ? Math.floor(baseTtl * 0.5) 
        : baseTtl;

      await this.cacheManager.set(cacheKey, generatedClass, adaptiveTtl);

      // Record performance metrics
      const duration = Date.now() - startTime;

      this.logger.log('DTO generated successfully', {
        schemaId: schema.id,
        duration,
        cacheUtilization: `${(memoryInfo.utilizationRate * 100).toFixed(1)}%`,
        adaptiveTtl,
      });

      return generatedClass;
    } catch (error) {
      const duration = Date.now() - startTime;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('DTO generation failed', {
        schemaId: schema.id,
        duration,
        error: errorMessage,
      });

      throw error;
    }
  }

  async validateData(
    data: unknown,
    schema: DynamicSchemaEntity
  ): Promise<{ isValid: boolean; errors: { property?: string; value?: unknown; constraints?: Record<string, string>; message?: string }[] }> {
    const DtoClass = await this.generateDto(schema);

    try {
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');

      const dto = plainToInstance(DtoClass, data);
      const errors = await validate(dto);

      return {
        isValid: errors.length === 0,
        errors: errors.map((error) => ({
          property: error.property,
          value: error.value,
          ...(error.constraints && { constraints: error.constraints }),
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Data validation failed', {
        schemaId: schema.id,
        error: errorMessage,
      });

      return {
        isValid: false,
        errors: [{ message: errorMessage }],
      };
    }
  }

  async generateDtoBatch(schemas: DynamicSchemaEntity[]): Promise<Map<string, ClassConstructor<object>>> {
    const startTime = Date.now();
    const results = new Map<string, ClassConstructor<object>>();
    const uncachedSchemas: DynamicSchemaEntity[] = [];

    // First pass: check cache for all schemas in parallel
    const cachePromises = schemas.map(async (schema) => {
      const cacheKey = this.generateCacheKey(schema);
      const cached = await this.cacheManager.get<ClassConstructor<object>>(cacheKey);
      return { schema, cacheKey, cached };
    });

    const cacheResults = await Promise.all(cachePromises);

    for (const { schema, cacheKey, cached } of cacheResults) {
      if (cached) {
        results.set(cacheKey, cached);
      } else {
        uncachedSchemas.push(schema);
      }
    }

    if (uncachedSchemas.length === 0) {
      this.logger.debug('All DTOs found in cache', { totalSchemas: schemas.length });
      return results;
    }

    // Validate all uncached schemas
    const validationPromises = uncachedSchemas.map((schema) => ({
      schema,
      validation: this.validationPipeline.validate(schema),
    }));

    const validatedSchemas = validationPromises
      .filter(({ validation }) => {
        if (!validation.isValid) {
          this.logger.error('Schema validation failed in batch', {
            errors: validation.errors,
          });
          return false;
        }
        return true;
      })
      .map(({ schema }) => schema);

    if (validatedSchemas.length !== uncachedSchemas.length) {
      throw new Error('Some schemas failed validation in batch processing');
    }

    // Generate DTOs in batch using pipeline
    const generatedClasses = this.generationPipeline.generateBatch(validatedSchemas);

    // Cache all generated classes
    const ttl = this.options.cache?.ttl ?? 3600; // 1 hour default
    const cachePromises2 = Array.from(generatedClasses.entries()).map(([cacheKey, generatedClass]) => this.cacheManager.set(cacheKey, generatedClass, ttl));

    await Promise.all(cachePromises2);

    // Merge results
    for (const [key, value] of generatedClasses) {
      results.set(key, value);
    }

    const totalTime = Date.now() - startTime;
    this.logger.debug('Batch DTO generation completed', {
      totalSchemas: schemas.length,
      cacheHits: schemas.length - uncachedSchemas.length,
      generated: validatedSchemas.length,
      totalTimeMs: totalTime,
    });

    return results;
  }

  private generateCacheKey(schema: DynamicSchemaEntity): string {
    // Generate comprehensive hash including schema metadata for better cache differentiation
    const schemaHash = this.generateSchemaHash(schema);
    const versionString = schema.version.toString();
    return `dto:${schema.name}:${versionString}:${schemaHash}`;
  }

  private generateSchemaHash(schema: DynamicSchemaEntity): string {
    // Create comprehensive schema signature including metadata
    const schemaSignature = {
      id: schema.id,
      fields: Object.entries(schema.properties)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
        .map(([fieldName, fieldSchema]) => {
          const isRequired = schema.getRequiredFields().includes(fieldName);
          return {
            name: fieldName,
            type: fieldSchema.type,
            required: isRequired,
            // Include field properties that affect DTO generation
            ...(fieldSchema.nullable !== undefined && { nullable: fieldSchema.nullable }),
            ...(fieldSchema.readonly !== undefined && { readonly: fieldSchema.readonly }),
            ...(fieldSchema.default !== undefined && { hasDefault: true }),
            ...(fieldSchema.validationStrategy && { validationStrategy: fieldSchema.validationStrategy }),
            ...(fieldSchema.customValidators && { hasCustomValidators: true }),
            ...(fieldSchema.conditionalValidation && { hasConditionalValidation: true }),
            ...(fieldSchema.displayHints && { hasDisplayHints: true }),
            ...(fieldSchema.permissions && { hasPermissions: true }),
            ...(fieldSchema.deprecated && { deprecated: fieldSchema.deprecated }),
            ...(fieldSchema.experimental !== undefined && { experimental: fieldSchema.experimental }),
            ...(fieldSchema.expose !== undefined && { expose: fieldSchema.expose }),
            ...(fieldSchema.exclude !== undefined && { exclude: fieldSchema.exclude })
          };
        }),
      required: schema.required.sort(), // Sort for consistency
      excludeAll: schema.excludeAll,
      // Include schema metadata in hash calculation for complete cache differentiation
      ...(schema.metadata && { metadata: schema.metadata })
    };

    // Use crypto.createHash for robust hash generation
    const hash = createHash('sha256')
      .update(JSON.stringify(schemaSignature))
      .digest('hex');

    // Return first 16 characters for reasonable cache key length
    return hash.substring(0, 16);
  }
}
