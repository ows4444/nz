import { Injectable, Logger } from '@nestjs/common';
import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { ClassConstructor } from '../../core/types/common.types';
import { DtoGenerationPipeline } from '../pipelines/dto-generation.pipeline';
import { DtoCacheService } from './dto-cache.service';
import { DtoValidationService } from './dto-validation.service';

export interface BatchResult {
  results: Map<string, ClassConstructor<object>>;
  metrics: BatchMetrics;
}

export interface BatchMetrics {
  totalSchemas: number;
  cacheHits: number;
  generated: number;
  totalTimeMs: number;
  validationFailures: number;
}

@Injectable()
export class DtoBatchProcessor {
  private readonly logger = new Logger(DtoBatchProcessor.name);

  constructor(
    private readonly generationPipeline: DtoGenerationPipeline,
    private readonly cacheService: DtoCacheService,
    private readonly validationService: DtoValidationService
  ) {}

  async processBatch(schemas: DynamicSchemaEntity[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results = new Map<string, ClassConstructor<object>>();
    const uncachedSchemas: DynamicSchemaEntity[] = [];

    // First pass: check cache for all schemas in parallel
    const cachePromises = schemas.map(async (schema) => {
      const cached = await this.cacheService.get<ClassConstructor<object>>(schema);
      return { schema, cached };
    });

    const cacheResults = await Promise.all(cachePromises);

    for (const { schema, cached } of cacheResults) {
      if (cached) {
        const cacheKey = this.cacheService.generateCacheKey(schema);
        results.set(cacheKey, cached);
      } else {
        uncachedSchemas.push(schema);
      }
    }

    if (uncachedSchemas.length === 0) {
      this.logger.debug('All DTOs found in cache', { totalSchemas: schemas.length });
      return {
        results,
        metrics: {
          totalSchemas: schemas.length,
          cacheHits: schemas.length,
          generated: 0,
          totalTimeMs: Date.now() - startTime,
          validationFailures: 0,
        },
      };
    }

    // Validate all uncached schemas
    const { validSchemas, invalidCount } = this.validationService.validateSchemas(uncachedSchemas);

    if (validSchemas.length !== uncachedSchemas.length) {
      throw new Error(`${invalidCount} schemas failed validation in batch processing`);
    }

    // Generate DTOs in batch using pipeline
    const generatedClasses = this.generationPipeline.generateBatch(validSchemas);

    // Cache all generated classes with adaptive TTL
    const adaptiveTtl = await this.cacheService.calculateAdaptiveTtl();
    const cachePromises2 = Array.from(generatedClasses.entries()).map(([cacheKey, generatedClass]) => {
      // Find the schema for this cache key to use the proper caching method
      const schema = validSchemas.find(s => this.cacheService.generateCacheKey(s) === cacheKey);
      if (schema) {
        return this.cacheService.set(schema, generatedClass, adaptiveTtl);
      }
      return Promise.resolve();
    });

    await Promise.all(cachePromises2);

    // Merge results
    for (const [key, value] of generatedClasses) {
      results.set(key, value);
    }

    const totalTime = Date.now() - startTime;
    const metrics: BatchMetrics = {
      totalSchemas: schemas.length,
      cacheHits: schemas.length - uncachedSchemas.length,
      generated: validSchemas.length,
      totalTimeMs: totalTime,
      validationFailures: invalidCount,
    };

    this.logger.debug('Batch DTO generation completed', metrics);

    return { results, metrics };
  }

  async getCachedResults(schemas: DynamicSchemaEntity[]): Promise<{ cached: Map<string, ClassConstructor<object>>; uncached: DynamicSchemaEntity[] }> {
    const cached = new Map<string, ClassConstructor<object>>();
    const uncached: DynamicSchemaEntity[] = [];

    const cachePromises = schemas.map(async (schema) => {
      const cachedResult = await this.cacheService.get<ClassConstructor<object>>(schema);
      return { schema, cachedResult };
    });

    const results = await Promise.all(cachePromises);

    for (const { schema, cachedResult } of results) {
      if (cachedResult) {
        const cacheKey = this.cacheService.generateCacheKey(schema);
        cached.set(cacheKey, cachedResult);
      } else {
        uncached.push(schema);
      }
    }

    return { cached, uncached };
  }
}