import { Module } from '@nestjs/common';
import { EnhancedStructuralSchemaValidator } from '../validators/schema-validators/enhanced-structural-schema.validator';
import { ValidationStrategyFactory } from '../infrastructure/factories/validation-strategy.factory';
import { StructuralValidationStrategy } from '../application/strategies/validation/structural-validation.strategy';
import { FieldValidationStrategy } from '../application/strategies/validation/field-validation.strategy';
import { CrossFieldValidationStrategy } from '../application/strategies/validation/cross-field-validation.strategy';
import { BaseSchemaValidator } from '../core/abstractions/base-schema-validator.abstract';

@Module({
  providers: [
    EnhancedStructuralSchemaValidator,

    // Provide EnhancedStructuralSchemaValidator as BaseSchemaValidator
    {
      provide: BaseSchemaValidator,
      useClass: EnhancedStructuralSchemaValidator,
    },

    ValidationStrategyFactory,
    StructuralValidationStrategy,
    FieldValidationStrategy,
    CrossFieldValidationStrategy,
  ],
  exports: [EnhancedStructuralSchemaValidator, BaseSchemaValidator, ValidationStrategyFactory, StructuralValidationStrategy, FieldValidationStrategy, CrossFieldValidationStrategy],
})
export class ValidationModule {}
