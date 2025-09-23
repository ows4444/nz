import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { BaseSchemaValidator } from '../../../core/abstractions/base-schema-validator.abstract';
import { EnhancedStructuralSchemaValidator } from '../../../validators/schema-validators/enhanced-structural-schema.validator';
import { ValidationResultMerger } from '../../../core/utils/validation-result-merger';

/**
 * Consolidated structural validation strategy that combines:
 * - Enhanced structural schema validation
 * - Base schema validation
 * This eliminates the need for separate Enhanced and Base validation strategies
 */
@Injectable()
export class StructuralValidationStrategy extends ValidationStrategy {
  readonly name = 'StructuralValidation';
  readonly order = 10;

  private readonly logger = new Logger(StructuralValidationStrategy.name);

  constructor(private readonly enhancedValidator: EnhancedStructuralSchemaValidator, private readonly baseSchemaValidator: BaseSchemaValidator) {
    super();
  }

  execute(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      const results: ValidationResult[] = [];

      // Enhanced structural validation
      const enhancedResult = context ? this.enhancedValidator.validateWithContext(schema.properties, context) : this.enhancedValidator.validate(schema.properties);
      results.push(enhancedResult);

      // Base schema validation
      const baseResult = this.baseSchemaValidator.validate(schema.properties, context, schema.name);
      results.push(baseResult);

      return ValidationResultMerger.mergeResults(results);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }
}
