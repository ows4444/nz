import { Injectable, Logger } from '@nestjs/common';
import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { classConstructor } from '../../core/types/common.types';
import type { ValidationResult } from '../../core/interfaces/validation/validation-result.interface';
import { ValidationResultFactory } from '../../core/interfaces/validation/validation-result.interface';
import type { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipeline } from '../pipelines/validation.pipeline';

@Injectable()
export class DtoValidationService {
  private readonly logger = new Logger(DtoValidationService.name);

  constructor(private readonly validationPipeline: ValidationPipeline) {}

  validateSchema(schema: DynamicSchemaEntity): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    // Input validation following enterprise standards
    if (!schema) {
      this.logger.error('Schema validation failed: null or undefined schema provided');
      return ValidationResultFactory.create({
        isValid: false,
        issues: [
          {
            severity: ValidationSeverity.error,
            code: 'INVALID_INPUT',
            message: 'Schema cannot be null or undefined',
          },
        ],
      });
    }

    const validationResult = this.validationPipeline.validate(schema);

    if (!validationResult.isValid) {
      this.logger.error('Schema validation failed', {
        schemaId: schema.id,
        issueCount: validationResult.issues.length,
      });
    }

    // The validation result already contains properly structured ValidationIssues
    // No need to transform them again - just pass them through
    return ValidationResultFactory.create({
      isValid: validationResult.isValid,
      issues: validationResult.issues,
    });
  }

  validateSchemas(schemas: DynamicSchemaEntity[]): {
    validSchemas: DynamicSchemaEntity[];
    invalidCount: number;
  } {
    const validSchemas: DynamicSchemaEntity[] = [];
    let invalidCount = 0;

    for (const schema of schemas) {
      const validation = this.validateSchema(schema);
      if (validation.isValid) {
        validSchemas.push(schema);
      } else {
        invalidCount++;
        this.logger.error('Schema validation failed in batch', {
          schemaId: schema.id,
          issueCount: validation.issues.length,
        });
      }
    }

    return { validSchemas, invalidCount };
  }

  async validateData(
    data: unknown,
    dtoClass: classConstructor<object>,
    schemaId: string
  ): Promise<
    ValidationResult & {
      readonly errors: ValidationIssue[];
      readonly warnings: ValidationIssue[];
      readonly infos: ValidationIssue[];
    }
  > {
    // Input validation following enterprise standards
    if (!dtoClass) {
      this.logger.error('Data validation failed: null or undefined DTO class provided', { schemaId });
      return ValidationResultFactory.create({
        isValid: false,
        issues: [
          {
            severity: ValidationSeverity.error,
            code: 'INVALID_DTO_CLASS',
            message: 'DTO class cannot be null or undefined',
            metadata: { schemaId },
          },
        ],
      });
    }

    try {
      const dto = plainToInstance(dtoClass, data);
      const classValidatorErrors = await validate(dto);

      const validationIssues: ValidationIssue[] = classValidatorErrors.map((error) => ({
        severity: ValidationSeverity.error,
        message: Object.values(error.constraints ?? {}).join(', ') || 'Validation failed',
        fieldPath: error.property,
        value: error.value as unknown,
        code: 'DATA_VALIDATION_ERROR',
        constraint: Object.keys(error.constraints ?? {})[0] ?? 'validation_failed',
        metadata: {
          property: error.property,
          constraints: error.constraints,
          schemaId,
        },
      }));

      const isValid = classValidatorErrors.length === 0;

      return ValidationResultFactory.create({
        isValid,
        issues: validationIssues,
        data: isValid ? dto : undefined,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Data validation failed with exception', {
        schemaId,
        error: errorMessage,
      });

      const errorIssue: ValidationIssue = {
        severity: ValidationSeverity.error,
        message: `Validation exception: ${errorMessage}`,
        code: 'VALIDATION_EXCEPTION',
        metadata: {
          error: errorMessage,
          schemaId,
        },
      };

      return ValidationResultFactory.create({
        isValid: false,
        issues: [errorIssue],
      });
    }
  }
}
