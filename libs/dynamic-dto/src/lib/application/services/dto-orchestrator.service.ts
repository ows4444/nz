import { Injectable, Logger } from '@nestjs/common';
import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { ClassConstructor } from '../../core/types/common.types';
import { DtoGenerationPipeline } from '../pipelines/dto-generation.pipeline';
import { DtoCacheService } from './dto-cache.service';
import { DtoValidationService } from './dto-validation.service';
import { DtoBatchProcessor } from './dto-batch-processor.service';
import type { ValidationResult } from './dto-validation.service';

@Injectable()
export class DtoOrchestratorService {
  private readonly logger = new Logger(DtoOrchestratorService.name);

  constructor(
    private readonly generationPipeline: DtoGenerationPipeline,
    private readonly cacheService: DtoCacheService,
    private readonly validationService: DtoValidationService,
    private readonly batchProcessor: DtoBatchProcessor
  ) {}

  private async generateDto(schema: DynamicSchemaEntity): Promise<ClassConstructor<object>> {
    const startTime = Date.now();

    try {
      // Check memory usage and cleanup if needed
      await this.cacheService.checkMemoryAndCleanup();

      // Check cache first
      const cached = await this.cacheService.get<ClassConstructor<object>>(schema);
      if (cached) {
        return cached;
      }

      // Validate schema
      const validationResult = this.validationService.validateSchema(schema);
      if (!validationResult.isValid) {
        throw new Error(`Schema validation failed: ${JSON.stringify(validationResult.errors)}`);
      }

      // Generate DTO
      const generatedClass = this.generationPipeline.generate(schema);

      // Cache result with adaptive TTL
      const adaptiveTtl = await this.cacheService.calculateAdaptiveTtl();
      await this.cacheService.set(schema, generatedClass, adaptiveTtl);

      // Record performance metrics
      const duration = Date.now() - startTime;
      this.logger.log('DTO generated successfully', {
        schemaId: schema.id,
        duration,
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

  async validateData(data: unknown, schema: DynamicSchemaEntity): Promise<ValidationResult> {
    const DtoClass = await this.generateDto(schema);
    return await this.validationService.validateData(data, DtoClass, schema.id);
  }

  async generateDtoBatch(schemas: DynamicSchemaEntity[]): Promise<Map<string, ClassConstructor<object>>> {
    const { results } = await this.batchProcessor.processBatch(schemas);
    return results;
  }

}
