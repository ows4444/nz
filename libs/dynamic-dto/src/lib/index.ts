// Main module export
export { DynamicDtoModule } from './dynamic-dto.module';

// Core services
export { DtoOrchestratorService } from './application/services/dto-orchestrator.service';
export { DtoValidationService } from './application/services/dto-validation.service';
export { DtoCacheService } from './application/services/dto-cache.service';
export { DtoBatchProcessor } from './application/services/dto-batch-processor.service';

// Field processor decorators and discovery (for advanced usage)
export { FieldProcessor, getFieldProcessorMetadata, isFieldProcessor } from './core/decorators/field-processor.decorator';
export type { FieldProcessorMetadata } from './core/decorators/field-processor.decorator';
export { FieldProcessorDiscoveryService } from './infrastructure/services/field-processor-discovery.service';
export type { DiscoveredProcessor } from './infrastructure/services/field-processor-discovery.service';

// Domain entities and value objects
export { DynamicSchemaEntity } from './domain/entities/dynamic-schema.entity';
export { SchemaValidationResultEntity } from './domain/entities/schema-validation-result.entity';

// Core types and interfaces
export { FieldType, FieldTypeValue } from './core/types/field.types';
export { ValidationSeverity } from './core/enums/validation.enums';
export type { classConstructor } from './core/types/common.types';

// Schema interfaces
export type { BaseFieldSchema } from './core/interfaces/schema/base/base-field.schema';
export type { StringFieldSchema } from './core/interfaces/schema/primitive/string-field.schema';
export type { ArrayFieldSchema } from './core/interfaces/schema/complex/array-field.schema';
export type { ObjectFieldSchema } from './core/interfaces/schema/complex/object-field.schema';
export type { UnionFieldSchema } from './core/interfaces/schema/specialized-primitives/union-field.schema';

// Cache interfaces
export type { ICacheManager, CacheMemoryInfo, CleanupResult } from './core/interfaces/cache/cache-manager.interface';
export type { ICacheStrategy } from './core/interfaces/cache/cache-strategy.interface';

// Validation types and utilities
export type { ValidationResult } from './core/interfaces/validation/validation-result.interface';
export { ValidationResultFactory } from './core/interfaces/validation/validation-result.interface';

// Validation context
export type { ValidationContext } from './core/interfaces/validation/validation-context.interface';

// Exception types
export { BaseValidationError } from './exceptions/validation/base-validation.error';
export { FieldTypeValidationError } from './exceptions/validation/field-validation.error';
export { SchemaValidationError } from './exceptions/validation/schema-processing.error';

// Monitoring and health check services
export { CacheMonitorService } from './infrastructure/monitoring/cache-monitor.service';
export { SystemMetricsService } from './infrastructure/monitoring/system-metrics.service';
export { PerformanceMetricsService } from './infrastructure/monitoring/performance-metrics.service';

export type { SystemMetrics, MemoryMetrics, PerformanceMetrics, CounterMetrics } from './infrastructure/monitoring/system-metrics.service';
export type { PerformanceSnapshot, ProcessingTimeMetrics, SchemaComplexityMetrics, ValidationMetrics, CacheEfficiencyMetrics } from './infrastructure/monitoring/performance-metrics.service';
