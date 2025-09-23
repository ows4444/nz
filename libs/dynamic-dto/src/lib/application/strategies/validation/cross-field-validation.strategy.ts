import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationResult } from '../../../core/interfaces/validation';
import { ValidationIssue } from '../../../core/interfaces/validation/validation-issue.interface';
import { ValidationSeverity } from '../../../core/enums/validation.enums';
import { ValidationResultCompatibilityUtil } from '../../../core/utils/validation-result-compatibility.util';

@Injectable()
export class CrossFieldValidationStrategy extends ValidationStrategy {
  readonly name = 'CrossFieldValidation';
  readonly order = 50;

  private readonly logger = new Logger(CrossFieldValidationStrategy.name);

  execute(schema: DynamicSchemaEntity): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      return this.validateCrossFieldRules(schema);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }

  private validateCrossFieldRules(schema: DynamicSchemaEntity): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Cross-field validation rules
    const fieldEntries = Object.entries(schema.properties);

    // Rule 1: Check for conflicting field configurations
    for (const [fieldName, fieldSchema] of fieldEntries) {
      // Check if field has both exclude and expose set
      if (fieldSchema.exclude && fieldSchema.expose) {
        issues.push({
          message: `Field '${fieldName}' cannot have both 'exclude' and 'expose' set to true`,
          code: 'CONFLICTING_FIELD_VISIBILITY',
          severity: ValidationSeverity.error,
          fieldPath: fieldName,
        });
      }
    }

    // Rule 2: Check for dependency validation
    for (const [fieldName, fieldSchema] of fieldEntries) {
      if (fieldSchema.conditionalValidation) {
        for (const condition of fieldSchema.conditionalValidation) {
          const dependentField = condition.condition.field;
          if (!schema.hasField(dependentField)) {
            issues.push({
              message: `Field '${fieldName}' has conditional validation depending on non-existent field '${dependentField}'`,
              code: 'MISSING_DEPENDENT_FIELD',
              severity: ValidationSeverity.error,
              fieldPath: fieldName,
              metadata: { dependentField },
            });
          }
        }
      }
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
    });
  }
}
