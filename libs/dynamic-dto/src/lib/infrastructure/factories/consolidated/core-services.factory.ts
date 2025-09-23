import type { Provider } from '@nestjs/common';

// Core orchestration services
import { DtoCacheService } from '../../../application/services/dto-cache.service';
import { DtoValidationService } from '../../../application/services/dto-validation.service';
import { DtoBatchProcessor } from '../../../application/services/dto-batch-processor.service';
import { DtoOrchestratorService } from '../../../application/services/dto-orchestrator.service';
import { SchemaOrchestratorService } from '../../../application/services/schema-orchestrator.service';

// Processing pipelines
import { DtoGenerationPipeline } from '../../../application/pipelines/dto-generation.pipeline';
import { ValidationPipeline } from '../../../application/pipelines/validation.pipeline';
import { SchemaValidationPipeline } from '../../../application/pipelines/schema-validation.pipeline';

/**
 * Consolidated Core Services Factory
 *
 * Combines orchestration services and processing pipelines into a single factory.
 * This reduces the factory proliferation from separate core-services and pipeline factories.
 *
 * Responsibilities:
 * - Main orchestration services (5 services)
 * - Sequential processing workflows (3 pipelines)
 */
export function createCoreServicesProviders(): Provider[] {
  return [
    // === ORCHESTRATION SERVICES ===
    DtoCacheService,
    DtoValidationService,
    DtoBatchProcessor,
    DtoOrchestratorService,
    SchemaOrchestratorService,

    // === PROCESSING PIPELINES ===
    DtoGenerationPipeline,
    ValidationPipeline,
    SchemaValidationPipeline,
  ];
}
