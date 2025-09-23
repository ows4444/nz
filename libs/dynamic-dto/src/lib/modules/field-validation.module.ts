import { Global, Module } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

// === FIELD VALIDATORS ===
// Primitive validators
import { StringFieldValidator } from '../validators/field-validators/primitive/string-field.validator';
import { NumberFieldValidator } from '../validators/field-validators/primitive/number-field.validator';
import { BooleanFieldValidator } from '../validators/field-validators/primitive/boolean-field.validator';

// Complex validators
import { ArrayFieldValidator } from '../validators/field-validators/complex/array-field.validator';
import { ObjectFieldValidator } from '../validators/field-validators/complex/object-field.validator';

// Specialized validators
import { DateFieldValidator } from '../validators/field-validators/specialized/date-field.validator';
import { UnionFieldValidator } from '../validators/field-validators/specialized/union-field.validator';

// === REGISTRIES & DISCOVERY ===
import { FieldValidatorRegistry } from '../infrastructure/registries/field-validator.registry';
import { FieldValidatorDiscoveryService } from '../infrastructure/services/field-validator-discovery.service';
import { FieldProcessorDiscoveryService } from '../infrastructure/services/field-processor-discovery.service';

// === UNIFIED FIELD HANDLER ===
import { FieldHandlerRegistry } from '../infrastructure/registries/field-handler.registry';
import { FieldHandlerDiscoveryService } from '../infrastructure/services/field-handler-discovery.service';

// === ERROR HANDLING ===
import { ValidationErrorService } from '../exceptions/validation/validation-error.service';
import { ValidationErrorRecoveryService } from '../exceptions/validation/validation-error-recovery.service';

@Global()
@Module({
  providers: [
    // === CORE DISCOVERY SERVICES ===
    DiscoveryService,
    Reflector,
    FieldValidatorDiscoveryService,
    FieldProcessorDiscoveryService,
    FieldHandlerDiscoveryService,

    // === FIELD VALIDATOR REGISTRY ===
    FieldValidatorRegistry,
    FieldHandlerRegistry,

    // === FIELD VALIDATORS ===
    // Primitive validators
    StringFieldValidator,
    NumberFieldValidator,
    BooleanFieldValidator,

    // Complex validators
    ArrayFieldValidator,
    ObjectFieldValidator,

    // Specialized validators
    DateFieldValidator,
    UnionFieldValidator,

    // === ERROR HANDLING SERVICES ===
    ValidationErrorService,
    ValidationErrorRecoveryService,

    // Backward compatibility aliases
    {
      provide: 'FieldValidatorRegistry',
      useExisting: FieldValidatorRegistry,
    },
    {
      provide: 'FieldProcessorRegistry',
      useExisting: FieldHandlerRegistry,
    },
  ],
  exports: [
    FieldValidatorRegistry,
    FieldHandlerRegistry,
    FieldValidatorDiscoveryService,
    FieldHandlerDiscoveryService,
    ValidationErrorService,
    ValidationErrorRecoveryService,
    // Export key validators for external use
    StringFieldValidator,
    NumberFieldValidator,
    BooleanFieldValidator,
    ArrayFieldValidator,
    ObjectFieldValidator,
  ],
})
export class FieldValidationModule {}
