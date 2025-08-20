import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationIssue } from '../../../core/interfaces/validation/validation-issue.interface';
import { ValidationSeverity } from '../../../core/enums/validation.enums';

@Injectable()
export class BusinessRulesValidationStrategy extends ValidationStrategy {
  readonly name = 'BusinessRulesValidation';
  readonly order = 40;

  private readonly logger = new Logger(BusinessRulesValidationStrategy.name);

  execute(schema: DynamicSchemaEntity, _context?: ValidationContext): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      return this.validateBusinessRules(schema);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }

  private validateBusinessRules(schema: DynamicSchemaEntity): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Enhanced business rules validation

    // Rule 1: Required fields must exist and have valid types
    for (const requiredField of schema.getRequiredFields()) {
      if (!schema.hasField(requiredField)) {
        issues.push({
          message: `Required field '${requiredField}' is missing in schema`,
          code: 'MISSING_REQUIRED_FIELD',
          severity: ValidationSeverity.error,
          fieldPath: requiredField,
        });
      }
    }

    // Rule 2: Schema versioning consistency
    if (schema.version) {
      const versionPattern = /^\d+\.\d+\.\d+$/;
      if (!versionPattern.test(schema.version.toString())) {
        issues.push({
          message: `Schema version '${schema.version.toString()}' must follow semantic versioning (x.y.z)`,
          code: 'INVALID_SCHEMA_VERSION',
          severity: ValidationSeverity.warning,
          fieldPath: 'version',
          metadata: { version: schema.version.toString() },
        });
      }
    }

    // Rule 3: Metadata consistency
    if (schema.metadata && Object.keys(schema.metadata).length === 0) {
      issues.push({
        message: 'Schema has empty metadata object',
        code: 'EMPTY_SCHEMA_METADATA',
        severity: ValidationSeverity.info,
        fieldPath: 'metadata',
      });
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }
}
