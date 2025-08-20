import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { ICacheManager } from '../../core/interfaces/cache/cache-manager.interface';
import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { ClassConstructor } from '../../core/types/common.types';
import { MODULE_OPTIONS_TOKEN } from '../../dynamic-dto.module-definition';
import type { DynamicDtoModuleOptions } from '../../interfaces/module-options.interface';

@Injectable()
export class DtoCacheService {
  private readonly logger = new Logger(DtoCacheService.name);

  constructor(
    @Inject('ICacheManager') private readonly cacheManager: ICacheManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: DynamicDtoModuleOptions
  ) {}

  async get<T = ClassConstructor<object>>(schema: DynamicSchemaEntity): Promise<T | null> {
    const cacheKey = this.generateCacheKey(schema);
    return await this.cacheManager.get<T>(cacheKey);
  }

  async set<T = ClassConstructor<object>>(
    schema: DynamicSchemaEntity, 
    value: T, 
    adaptiveTtl?: number
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(schema);
    
    // Use adaptive TTL if provided, otherwise use configured or default TTL
    const ttl = adaptiveTtl ?? this.options.cache?.ttl ?? 3600; // 1 hour default
    
    await this.cacheManager.set(cacheKey, value, ttl);
    
    this.logger.debug('Cached DTO', {
      schemaId: schema.id,
      cacheKey,
      ttl,
    });
  }

  async calculateAdaptiveTtl(): Promise<number> {
    const memoryInfo = await this.cacheManager.getMemoryUsage();
    const baseTtl = this.options.cache?.ttl ?? 3600; // 1 hour default
    
    // Reduce TTL if memory utilization is high
    const adaptiveTtl = memoryInfo.utilizationRate > 0.8 
      ? Math.floor(baseTtl * 0.5) 
      : baseTtl;

    return adaptiveTtl;
  }

  async checkMemoryAndCleanup(): Promise<void> {
    const memoryExceeded = await this.cacheManager.isMemoryThresholdExceeded();
    if (memoryExceeded) {
      this.logger.warn('Cache memory threshold exceeded, performing cleanup');
      await this.cacheManager.cleanup(false);
    }
  }

  generateCacheKey(schema: DynamicSchemaEntity): string {
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