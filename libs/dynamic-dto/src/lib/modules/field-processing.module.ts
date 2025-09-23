import { Global, Module } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

// === FIELD PROCESSORS ===
// Primitive processors
import { NumberFieldProcessor } from '../processors/field-processors/primitive/number-field.processor';
import { BooleanFieldProcessor } from '../processors/field-processors/primitive/boolean-field.processor';

// String processors
import { StringBasicProcessor } from '../processors/field-processors/primitive/string-basic.processor';
import { StringFormatProcessor } from '../processors/field-processors/primitive/string-format.processor';
import { StringTransformationProcessor } from '../processors/field-processors/primitive/string-transformation.processor';
import { StringAutoGenerationProcessor } from '../processors/field-processors/primitive/string-auto-generation.processor';
import { StringFieldProcessorComposite } from '../processors/field-processors/primitive/string-field-composite.processor';
import { StringFormatProcessorFactory } from '../processors/field-processors/primitive/string-formats/string-format-processor.factory';

// Specialized processors
import { DateFieldProcessor } from '../processors/field-processors/specialized/date-field.processor';
import { UnionFieldProcessor } from '../processors/field-processors/specialized/union-field.processor';

// Union processor services (extracted after SRP refactoring)
import {
  UnionDiscriminatorHandlerService,
  UnionSafeDefaultService,
  UnionTransformerService,
  UnionTypeDetectorService,
  UnionValidatorRegistry,
  UnionValidatorService,
} from '../processors/field-processors/specialized/services';

// Complex processors
import { ArrayFieldProcessor } from '../processors/field-processors/complex/array-field.processor';
import { ObjectFieldProcessorComposite } from '../processors/field-processors/complex/object-field-composite.processor';

// Object processing services
import { CircularReferenceDetectorService } from '../processors/field-processors/complex/services/circular-reference-detector.service';
import { ObjectValidationService } from '../processors/field-processors/complex/services/object-validation.service';
import { PropertyFilteringService } from '../processors/field-processors/complex/services/property-filtering.service';
import { NestedObjectTransformerService } from '../processors/field-processors/complex/services/nested-object-transformer.service';

// === REGISTRIES & DISCOVERY ===
import { FieldProcessorRegistry } from '../infrastructure/registries/field-processor.registry';
import { FieldProcessorDiscoveryService } from '../infrastructure/services/field-processor-discovery.service';
import { NestedClassGeneratorService } from '../infrastructure/services/nested-class-generator.service';

@Global()
@Module({
  providers: [
    // === CORE DISCOVERY SERVICES ===
    DiscoveryService,
    Reflector,
    FieldProcessorDiscoveryService,

    // === FIELD PROCESSOR REGISTRY ===
    FieldProcessorRegistry,

    // === NESTED CLASS GENERATION ===
    NestedClassGeneratorService,

    // === STRING PROCESSING INFRASTRUCTURE ===
    StringFormatProcessorFactory,

    // === FIELD PROCESSORS ===
    // String processors
    StringBasicProcessor,
    StringFormatProcessor,
    StringTransformationProcessor,
    StringAutoGenerationProcessor,
    StringFieldProcessorComposite,

    // Other primitive processors
    NumberFieldProcessor,
    BooleanFieldProcessor,

    // Specialized processors
    DateFieldProcessor,
    UnionFieldProcessor,

    // Union processor services (extracted for SRP compliance)
    UnionTypeDetectorService,
    UnionValidatorService,
    UnionDiscriminatorHandlerService,
    UnionTransformerService,
    UnionSafeDefaultService,
    UnionValidatorRegistry,

    // Complex processors
    ArrayFieldProcessor,
    ObjectFieldProcessorComposite,

    // Object processing services
    CircularReferenceDetectorService,
    ObjectValidationService,
    PropertyFilteringService,
    NestedObjectTransformerService,

    // String token provider for legacy injection
    {
      provide: 'FieldProcessorRegistry',
      useExisting: FieldProcessorRegistry,
    },
  ],
  exports: [
    FieldProcessorRegistry,
    FieldProcessorDiscoveryService,
    // Export key processors for external use
    StringFieldProcessorComposite,
    NumberFieldProcessor,
    BooleanFieldProcessor,
    DateFieldProcessor,
    ArrayFieldProcessor,
    ObjectFieldProcessorComposite,
    // Export string token for legacy injection
    'FieldProcessorRegistry',
  ],
})
export class FieldProcessingModule {}
