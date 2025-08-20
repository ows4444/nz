import { Injectable, Logger } from '@nestjs/common';
import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import { ValidationStrategyFactory } from '../../infrastructure/factories/validation-strategy.factory';
import { ValidationChain } from '../../core/patterns/validation-chain';

@Injectable()
export class ValidationPipeline {
  private readonly logger = new Logger(ValidationPipeline.name);
  private readonly validationChain: ValidationChain;

  constructor(private readonly validationStrategyFactory: ValidationStrategyFactory) {
    this.validationChain = this.validationStrategyFactory.createValidationChain();
  }

  validate(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    try {
      this.logger.debug(`Starting validation for schema: ${schema.name}`);

      const result = this.validationChain.execute(schema, context);

      this.logger.debug(`Validation completed for schema: ${schema.name}. Valid: ${result.isValid}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Validation failed for schema: ${schema.name}`, error);
      return {
        isValid: false,
        issues: [
          {
            message: `Validation pipeline failed: ${errorMessage}`,
            code: 'VALIDATION_PIPELINE_ERROR',
            severity: ValidationSeverity.error,
            fieldPath: schema.name,
            metadata: { error: errorMessage },
          },
        ],
        errors: [
          {
            message: `Validation pipeline failed: ${errorMessage}`,
            code: 'VALIDATION_PIPELINE_ERROR',
            severity: ValidationSeverity.error,
            fieldPath: schema.name,
            metadata: { error: errorMessage },
          },
        ],
        warnings: [],
        infos: [],
      };
    }
  }

  validateWithCustomStrategies(schema: DynamicSchemaEntity, strategies: string[], context?: ValidationContext): ValidationResult {
    const customChain = this.validationStrategyFactory.createCustomValidationChain(strategies);

    try {
      this.logger.debug(`Starting custom validation for schema: ${schema.name} with strategies: [${strategies.join(', ')}]`);

      const result = customChain.execute(schema, context);

      this.logger.debug(`Custom validation completed for schema: ${schema.name}. Valid: ${result.isValid}`);
      return result;
    } catch (error) {
      this.logger.error(`Custom validation failed for schema: ${schema.name}`, error);
      throw error;
    }
  }

  getValidationChain(): ValidationChain {
    return this.validationChain;
  }

  getAvailableStrategies(): string[] {
    return this.validationStrategyFactory.getAllStrategies().map((strategy) => strategy.name);
  }
}
