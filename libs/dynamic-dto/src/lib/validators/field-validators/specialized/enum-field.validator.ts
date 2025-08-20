import { Injectable } from '@nestjs/common';
import { BaseFieldValidator } from '../../../core/abstractions/base-field-validator.abstract';
import { EnumFieldSchema } from '../../../core/interfaces/schema/specialized-primitives/enum-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import type { ValidationContext, ValidationIssue, ValidationResult } from '../../../core/interfaces/validation';

@Injectable()
export class EnumFieldValidator extends BaseFieldValidator<EnumFieldSchema> {
  readonly supportedType = FieldType.enum;
  readonly priority = 100;
  readonly name = 'enum-field-validator';

  canValidate(schema: FieldSchema): schema is EnumFieldSchema {
    return schema.type === FieldType.enum;
  }

  validateFieldSchema(schema: EnumFieldSchema): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Validate enum values exist and are not empty
    if (!schema.values || schema.values.length === 0) {
      issues.push({
        code: 'ENUM_NO_VALUES',
        message: 'Enum field must have at least one value',
        severity: 'error',
        fieldPath: 'values',
      });
    }

    // Validate enum values are of consistent types
    if (schema.values && schema.values.length > 1) {
      const firstType = typeof schema.values[0];
      const hasConsistentTypes = schema.values.every((value) => typeof value === firstType);

      if (!hasConsistentTypes && schema.caseSensitive !== false) {
        issues.push({
          code: 'ENUM_MIXED_TYPES',
          message: 'Enum values should be of consistent types (all strings or all numbers) unless case-insensitive',
          severity: 'warning',
          fieldPath: 'values',
        });
      }
    }

    // Validate duplicate values
    if (schema.values) {
      const uniqueValues = new Set(schema.values);
      if (uniqueValues.size !== schema.values.length) {
        issues.push({
          code: 'ENUM_DUPLICATE_VALUES',
          message: 'Enum contains duplicate values',
          severity: 'error',
          fieldPath: 'values',
        });
      }
    }

    // Validate default value
    if (schema.default !== undefined) {
      const isValidDefault = this.validateDefaultValue(schema);
      if (!isValidDefault) {
        issues.push({
          code: 'ENUM_INVALID_DEFAULT',
          message: 'Default value must be one of the enum values or a valid default configuration',
          severity: 'error',
          fieldPath: 'default',
        });
      }
    }

    // Validate labels mapping
    if (schema.labels) {
      const invalidLabels = Object.keys(schema.labels).filter((key) => {
        const keyAsValue = isNaN(Number(key)) ? key : Number(key);
        return !schema.values.includes(keyAsValue);
      });

      if (invalidLabels.length > 0) {
        issues.push({
          code: 'ENUM_INVALID_LABELS',
          message: `Labels contain keys not present in enum values: ${invalidLabels.join(', ')}`,
          severity: 'warning',
          fieldPath: 'labels',
        });
      }
    }

    // Validate deprecated values
    if (schema.deprecatedValues) {
      const invalidDeprecated = schema.deprecatedValues.filter((value) => !schema.values.includes(value));
      if (invalidDeprecated.length > 0) {
        issues.push({
          code: 'ENUM_INVALID_DEPRECATED',
          message: `Deprecated list contains values not in enum: ${invalidDeprecated.join(', ')}`,
          severity: 'warning',
          fieldPath: 'deprecatedValues',
        });
      }
    }

    // Validate allowMultiple configuration
    if (schema.allowMultiple && schema.caseSensitive === false) {
      issues.push({
        code: 'ENUM_MULTIPLE_CASE_INSENSITIVE',
        message: 'Multiple selection with case-insensitive matching may cause ambiguous behavior',
        severity: 'warning',
        fieldPath: 'allowMultiple',
      });
    }

    return {
      isValid: issues.filter((issue) => issue.severity === 'error').length === 0,
      issues,
    };
  }

  validateFieldValue(value: unknown, schema: EnumFieldSchema): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (value === undefined || value === null) {
      // Note: Required validation is handled at the processor level
      return { isValid: true, issues };
    }

    if (schema.allowMultiple) {
      if (!Array.isArray(value)) {
        // Single value is allowed for multiple enums
        return this.validateSingleEnumValue(value, schema);
      } else {
        // Validate array of values
        for (let i = 0; i < value.length; i++) {
          const itemValidation = this.validateSingleEnumValue(value[i], schema);
          if (!itemValidation.isValid) {
            issues.push(
              ...itemValidation.issues.map((issue) => ({
                ...issue,
                path: `value[${i}]`,
              }))
            );
          }
        }

        // Check for duplicates in multiple values
        const uniqueValues = new Set(value);
        if (uniqueValues.size !== value.length) {
          issues.push({
            code: 'ENUM_DUPLICATE_SELECTED',
            message: 'Multiple enum selection contains duplicate values',
            severity: 'warning',
            fieldPath: 'value',
          });
        }
      }
    } else {
      const singleValidation = this.validateSingleEnumValue(value, schema);
      issues.push(...singleValidation.issues);
    }

    return {
      isValid: issues.filter((issue) => issue.severity === 'error').length === 0,
      issues,
    };
  }

  private validateSingleEnumValue(value: unknown, schema: EnumFieldSchema): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Check if value is in enum
    let isValidEnumValue = false;

    if (schema.caseSensitive === false && typeof value === 'string') {
      // Case-insensitive matching
      isValidEnumValue = schema.values.some((enumValue) => typeof enumValue === 'string' && enumValue.toLowerCase() === value.toLowerCase());
    } else {
      // Standard matching
      isValidEnumValue = schema.values.includes(value as string | number);
    }

    if (!isValidEnumValue) {
      if (schema.strict !== false) {
        issues.push({
          code: 'ENUM_INVALID_VALUE',
          message: `Value "${String(value)}" is not a valid enum value. Valid values: ${schema.values.join(', ')}`,
          severity: 'error',
          fieldPath: 'value',
        });
      } else {
        issues.push({
          code: 'ENUM_NON_STRICT_VALUE',
          message: `Value "${String(value)}" is not in enum but allowed due to non-strict mode`,
          severity: 'info',
          fieldPath: 'value',
        });
      }
    }

    // Check for deprecated values
    if (isValidEnumValue && schema.deprecatedValues?.includes(value as string | number)) {
      issues.push({
        code: 'ENUM_DEPRECATED_VALUE',
        message: `Value "${String(value)}" is deprecated`,
        severity: 'warning',
        fieldPath: 'value',
      });
    }

    return {
      isValid: issues.filter((issue) => issue.severity === 'error').length === 0,
      issues,
    };
  }

  private validateDefaultValue(schema: EnumFieldSchema): boolean {
    if (schema.default === undefined) return true;

    // If default is an object (DefaultValue configuration)
    if (typeof schema.default === 'object' && schema.default !== null) {
      const defaultConfig = schema.default;
      return ['first', 'random', 'computed'].includes(defaultConfig.type);
    }

    // If default is a direct value, check if it's in enum
    if (schema.caseSensitive === false && typeof schema.default === 'string') {
      return schema.values.some((value) => typeof value === 'string' && value.toLowerCase() === (schema.default as string).toLowerCase());
    }

    return schema.values.includes(schema.default);
  }

  validateStructure(schema: EnumFieldSchema, _context: ValidationContext): ValidationResult {
    // For now, delegate to validateFieldSchema
    return this.validateFieldSchema(schema);
  }

  validateConstraints(schema: EnumFieldSchema, context: ValidationContext): ValidationResult {
    // For now, delegate to validateFieldValue using the data from context
    return this.validateFieldValue(context.data, schema);
  }
}
