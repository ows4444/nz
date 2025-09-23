import { DynamicModule, Module } from '@nestjs/common';

// Feature modules with lazy loading support
import { CacheModule, FieldProcessingModule, FieldValidationModule, MonitoringModule, ValidationModule } from './modules';

// Core services only
import { DtoCacheService } from './application/services/dto-cache.service';
import { DtoValidationService } from './application/services/dto-validation.service';
import { DtoBatchProcessor } from './application/services/dto-batch-processor.service';
import { DtoOrchestratorService } from './application/services/dto-orchestrator.service';
import { SchemaOrchestratorService } from './application/services/schema-orchestrator.service';

// Core pipelines
import { DtoGenerationPipeline } from './application/pipelines/dto-generation.pipeline';
import { ValidationPipeline } from './application/pipelines/validation.pipeline';
import { SchemaValidationPipeline } from './application/pipelines/schema-validation.pipeline';

// Infrastructure services
import { NestedClassGeneratorService } from './infrastructure/services/nested-class-generator.service';

// Configuration
import { DynamicDtoModuleOptions } from './interfaces/module-options.interface';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './dynamic-dto.module-definition';

@Module({})
export class DynamicDtoModule extends ConfigurableModuleClass {
  static forRoot(options: DynamicDtoModuleOptions = {}): DynamicModule {
    return {
      module: DynamicDtoModule,
      global: options.isGlobal ?? false,
      imports: [
        // Core feature modules (always loaded)
        FieldProcessingModule,
        FieldValidationModule,
        ValidationModule,
        MonitoringModule,
        CacheModule,
        // Additional user imports
        ...(options.imports ?? []),
      ],
      providers: [
        // Module options
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },

        // === CORE SERVICES (8 providers) ===
        DtoCacheService,
        DtoValidationService,
        DtoBatchProcessor,
        DtoOrchestratorService,
        SchemaOrchestratorService,

        // === CORE PIPELINES (3 providers) ===
        DtoGenerationPipeline,
        ValidationPipeline,
        SchemaValidationPipeline,

        // === INFRASTRUCTURE SERVICES (1 provider) ===
        NestedClassGeneratorService,
      ],
      exports: [
        // Core public API services
        DtoOrchestratorService,
        DtoValidationService,
        DtoCacheService,
        DtoBatchProcessor,
        SchemaOrchestratorService,
        MODULE_OPTIONS_TOKEN,

        // Processing pipelines
        DtoGenerationPipeline,
        ValidationPipeline,
        SchemaValidationPipeline,

        // Infrastructure services
        NestedClassGeneratorService,
      ],
    };
  }
}
