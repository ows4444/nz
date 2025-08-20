import { DynamicModule, Module, Provider } from '@nestjs/common';

// Core services
import { DtoOrchestratorService } from './application/services/dto-orchestrator.service';
import { SchemaOrchestratorService } from './application/services/schema-orchestrator.service';

// Pipelines
import { DtoGenerationPipeline } from './application/pipelines/dto-generation.pipeline';
import { ValidationPipeline } from './application/pipelines/validation.pipeline';
import { SchemaValidationPipeline } from './application/pipelines/schema-validation.pipeline';

// Infrastructure
import { CacheManagerService } from './infrastructure/cache/cache-manager.service';
import { MemoryCacheStrategy } from './infrastructure/cache/strategies/memory-cache.strategy';

// Registries (refactored to avoid circular dependencies)
import { FieldProcessorRegistry } from './infrastructure/registries/field-processor.registry';
import { FieldValidatorRegistry } from './infrastructure/registries/field-validator.registry';

// Schema Validators
import { EnhancedStructuralSchemaValidator } from './validators/schema-validators/enhanced-structural-schema.validator';
import { BaseSchemaValidator } from './core/abstractions/base-schema-validator.abstract';

// Field Processors - Factory pattern to handle circular deps
import { createFieldProcessorProviders } from './infrastructure/factories/field-processor.factory';
import { createFieldValidatorProviders } from './infrastructure/factories/field-validator.factory';

// Configuration
import { DynamicDtoModuleOptions } from './interfaces/module-options.interface';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './dynamic-dto.module-definition';

// Services
import { ValidationErrorRecoveryService, ValidationErrorService } from './exceptions/validation';
import { NestedClassGeneratorService } from './infrastructure/services/nested-class-generator.service';

// Mediator and dependency resolution
import { FieldProcessingMediator } from './core/mediators/field-processing.mediator';
import { DependencyResolverService } from './infrastructure/initialization/dependency-resolver.service';

// Validation strategies
import { ValidationStrategyFactory } from './infrastructure/factories/validation-strategy.factory';
import { EnhancedSchemaValidationStrategy } from './application/strategies/validation/enhanced-schema-validation.strategy';
import { BaseSchemaValidationStrategy } from './application/strategies/validation/base-schema-validation.strategy';
import { FieldRegistryValidationStrategy } from './application/strategies/validation/field-registry-validation.strategy';
import { BusinessRulesValidationStrategy } from './application/strategies/validation/business-rules-validation.strategy';
import { CrossFieldValidationStrategy } from './application/strategies/validation/cross-field-validation.strategy';

@Module({})
export class DynamicDtoModule extends ConfigurableModuleClass {
  static forRoot(options: DynamicDtoModuleOptions = {}): DynamicModule {
    const cacheProviders = this.createCacheProviders(options);
    const fieldProcessorProviders = createFieldProcessorProviders();
    const fieldValidatorProviders = createFieldValidatorProviders();

    return {
      module: DynamicDtoModule,
      global: options.isGlobal ?? false,
      imports: [...(options.imports ?? [])],
      providers: [
        // Module options
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },

        // Core Application Services
        DtoOrchestratorService,
        SchemaOrchestratorService,

        // Pipelines
        DtoGenerationPipeline,
        ValidationPipeline,
        SchemaValidationPipeline,

        // Infrastructure Services
        ...cacheProviders,

        // Registries
        FieldProcessorRegistry,
        FieldValidatorRegistry,

        // Field Processors and Validators (after registries)
        ...fieldProcessorProviders,
        ...fieldValidatorProviders,

        // Mediator pattern to resolve circular dependencies
        FieldProcessingMediator,
        DependencyResolverService,

        // Infrastructure services (after processors)
        NestedClassGeneratorService,

        // Schema Validators
        EnhancedStructuralSchemaValidator,
        {
          provide: BaseSchemaValidator,
          useClass: EnhancedStructuralSchemaValidator,
        },

        // Validation strategies
        ValidationStrategyFactory,
        EnhancedSchemaValidationStrategy,
        BaseSchemaValidationStrategy,
        FieldRegistryValidationStrategy,
        BusinessRulesValidationStrategy,
        CrossFieldValidationStrategy,

        // Validation services
        ValidationErrorService,
        ValidationErrorRecoveryService,
      ],
      exports: [DtoOrchestratorService, NestedClassGeneratorService, SchemaOrchestratorService, FieldProcessorRegistry, FieldValidatorRegistry, SchemaValidationPipeline],
    };
  }

  private static createCacheProviders(_options: DynamicDtoModuleOptions): Provider[] {
    return [
      {
        provide: 'ICacheStrategy',
        useClass: MemoryCacheStrategy,
      },
      CacheManagerService,
      {
        provide: 'ICacheManager',
        useClass: CacheManagerService,
      },
    ];
  }
}
