import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationIssue } from '../../../core/interfaces/validation/validation-issue.interface';
import { ValidationSeverity } from '../../../core/enums/validation.enums';
import { FieldHandlerRegistry } from '../../../infrastructure/registries/field-handler.registry';
import { ValidationResultMerger } from '../../../core/utils/validation-result-merger';
import { ValidationResultCompatibilityUtil } from '../../../core/utils/validation-result-compatibility.util';

/**
 * Consolidated field validation strategy that combines:
 * - Field registry validation
 * - Business rules validation
 * This eliminates duplicate validation patterns and simplifies the architecture
 */
@Injectable()
export class FieldValidationStrategy extends ValidationStrategy {
  readonly name = 'FieldValidation';
  readonly order = 20;

  private readonly logger = new Logger(FieldValidationStrategy.name);

  constructor(private readonly fieldHandlerRegistry: FieldHandlerRegistry) {
    super();
  }

  execute(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      const results: ValidationResult[] = [];

      // Field registry validation
      const fieldValidationResult = this.validateFieldsWithRegistry(schema, context);
      results.push(fieldValidationResult);

      // Business rules validation
      const businessRulesResult = this.validateBusinessRules(schema);
      results.push(businessRulesResult);

      return ValidationResultMerger.mergeResults(results);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }

  private validateFieldsWithRegistry(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    const results: ValidationResult[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const fieldContext: ValidationContext = {
        fieldPath: fieldName,
        depth: 0,
        parentType: 'schema',
        schemaName: schema.name,
        ...(context?.userRoles !== undefined && {
          userRoles: context.userRoles,
        }),
        data: context?.data,
      };

      const result = this.fieldHandlerRegistry.validateField(fieldSchema, fieldContext);
      results.push(result);
    }

    return ValidationResultMerger.mergeResults(results);
  }

  private validateBusinessRules(schema: DynamicSchemaEntity): ValidationResult {
    const issues: ValidationIssue[] = [];

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

    // Rule 2: Metadata consistency
    if (schema.metadata && Object.keys(schema.metadata).length === 0) {
      issues.push({
        message: 'Schema has empty metadata object',
        code: 'EMPTY_SCHEMA_METADATA',
        severity: ValidationSeverity.info,
        fieldPath: 'metadata',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
    });
  }
}
