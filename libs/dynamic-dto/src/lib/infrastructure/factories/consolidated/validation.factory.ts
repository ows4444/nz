import type { Provider } from '@nestjs/common';

// === VALIDATION STRATEGIES ===
import { ValidationStrategyFactory } from '../validation-strategy.factory';
import { StructuralValidationStrategy } from '../../../application/strategies/validation/structural-validation.strategy';
import { FieldValidationStrategy } from '../../../application/strategies/validation/field-validation.strategy';
import { CrossFieldValidationStrategy } from '../../../application/strategies/validation/cross-field-validation.strategy';

// === SCHEMA VALIDATION ===
import { EnhancedStructuralSchemaValidator } from '../../../validators/schema-validators/enhanced-structural-schema.validator';
import { BaseSchemaValidator } from '../../../core/abstractions/base-schema-validator.abstract';

// === ERROR HANDLING ===
import { ValidationErrorService } from '../../../exceptions/validation/validation-error.service';
import { ValidationErrorRecoveryService } from '../../../exceptions/validation/validation-error-recovery.service';

/**
 * Consolidated Validation Factory
 *
 * Combines validation strategies, schema validation, and error handling into a single factory.
 * This reduces the factory proliferation from separate validation-strategies, schema-validation,
 * and error-handling factories.
 *
 * Responsibilities:
 * - Validation strategies (3 consolidated strategies)
 * - Schema structure validation
 * - Error handling and recovery services
 * - Validation pipeline coordination
 */
export function createValidationProviders(): Provider[] {
  return [
    // === VALIDATION STRATEGY INFRASTRUCTURE ===
    ValidationStrategyFactory,

    // === VALIDATION STRATEGIES ===
    // Reduced from 5 strategies to 3 focused strategies for better maintainability
    StructuralValidationStrategy,
    FieldValidationStrategy,
    CrossFieldValidationStrategy,

    // === SCHEMA VALIDATION ===
    EnhancedStructuralSchemaValidator,
    {
      provide: BaseSchemaValidator,
      useClass: EnhancedStructuralSchemaValidator,
    },

    // === ERROR HANDLING & RECOVERY ===
    ValidationErrorService,
    ValidationErrorRecoveryService,
  ];
}
