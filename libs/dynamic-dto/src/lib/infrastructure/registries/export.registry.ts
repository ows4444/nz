import type { Type } from '@nestjs/common';

// Core orchestration services (primary public API)
import { DtoOrchestratorService } from '../../application/services/dto-orchestrator.service';
import { DtoValidationService } from '../../application/services/dto-validation.service';
import { DtoCacheService } from '../../application/services/dto-cache.service';
import { DtoBatchProcessor } from '../../application/services/dto-batch-processor.service';
import { SchemaOrchestratorService } from '../../application/services/schema-orchestrator.service';

// Processing pipelines
import { DtoGenerationPipeline } from '../../application/pipelines/dto-generation.pipeline';
import { ValidationPipeline } from '../../application/pipelines/validation.pipeline';

// Infrastructure registries and discovery services (for extensibility)
import { FieldHandlerRegistry } from './field-handler.registry';
import { FieldProcessorRegistry } from './field-processor.registry';
import { FieldValidatorRegistry } from './field-validator.registry';
import { FieldProcessorDiscoveryService } from '../services/field-processor-discovery.service';
import { FieldHandlerDiscoveryService } from '../services/field-handler-discovery.service';

// Cache management
import { CacheManagerService } from '../cache/cache-manager.service';

/**
 * Centralized registry of all services that should be exported from the DynamicDtoModule.
 *
 * This eliminates the need for complex runtime filtering and type guards in the module configuration.
 * Services are organized by category for better maintainability.
 *
 * To add a new exportable service:
 * 1. Add it to the appropriate category array
 * 2. Import it at the top of this file
 *
 * No changes to module configuration are needed.
 */
export class ExportRegistry {
  /**
   * Primary public API - Core services that consumers will typically use
   */
  static readonly coreServices: Type[] = [DtoOrchestratorService, DtoValidationService, DtoCacheService, DtoBatchProcessor, SchemaOrchestratorService];

  /**
   * Processing workflows - For advanced users who need pipeline control
   */
  static readonly pipelines: Type[] = [DtoGenerationPipeline, ValidationPipeline];

  /**
   * Infrastructure services - For extensibility and advanced configuration
   */
  static readonly infrastructure: Type[] = [FieldHandlerRegistry, FieldProcessorRegistry, FieldValidatorRegistry, FieldProcessorDiscoveryService, FieldHandlerDiscoveryService, CacheManagerService];

  /**
   * Returns all exportable services in a single array.
   * This is the main method used by the module configuration.
   */
  static getAllExports(): Type[] {
    return [...this.coreServices, ...this.pipelines, ...this.infrastructure];
  }

  /**
   * Returns only the core public API services.
   * Useful for creating minimal export sets in specific scenarios.
   */
  static getCoreExports(): Type[] {
    return [...this.coreServices];
  }

  /**
   * Returns extended exports including infrastructure services.
   * Useful when consumers need advanced extensibility features.
   */
  static getExtendedExports(): Type[] {
    return [...this.coreServices, ...this.pipelines, ...this.infrastructure];
  }
}
