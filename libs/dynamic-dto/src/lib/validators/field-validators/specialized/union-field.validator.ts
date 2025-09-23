import { Injectable } from '@nestjs/common';
import { FieldValidator } from '../../../core/decorators/field-validator.decorator';
import { BaseFieldValidator } from '../../../core/abstractions/base-field-validator.abstract';
import { UnionFieldSchema, UnionValidationStrategy } from '../../../core/interfaces/schema/specialized-primitives/union-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import type { ValidationContext, ValidationIssue, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationResultCompatibilityUtil } from '../../../core/utils/validation-result-compatibility.util';

@FieldValidator({ type: FieldType.union, priority: 1, category: 'specialized' })
@Injectable()
export class UnionFieldValidator extends BaseFieldValidator<UnionFieldSchema> {
  readonly supportedType = FieldType.union;
  readonly priority = 100;
  readonly name = 'union-field-validator';

  canValidate(schema: FieldSchema): schema is UnionFieldSchema {
    return schema.type === FieldType.union;
  }

  validateFieldSchema(schema: UnionFieldSchema): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Validate union types exist and are not empty
    if (!schema.unionTypes || schema.unionTypes.length === 0) {
      issues.push({
        code: 'UNION_NO_TYPES',
        message: 'Union field must have at least one type',
        severity: 'error',
        fieldPath: 'unionTypes',
      });
      return ValidationResultCompatibilityUtil.createFromLegacy({
        isValid: false,
        issues,
      });
    }

    if (schema.unionTypes.length === 1) {
      issues.push({
        code: 'UNION_SINGLE_TYPE',
        message: 'Union with single type should use the type directly instead of union',
        severity: 'warning',
        fieldPath: 'unionTypes',
      });
    }

    // Validate each union type schema
    for (let i = 0; i < schema.unionTypes.length; i++) {
      const unionType = schema.unionTypes[i];
      if (!unionType?.type) {
        issues.push({
          code: 'UNION_INVALID_TYPE_SCHEMA',
          message: `Union type at index ${i} must have a type property`,
          severity: 'error',
          fieldPath: `unionTypes[${i}]`,
        });
      }
    }

    // Validate discriminator configuration
    if (schema.discriminator) {
      const discriminatorIssues = this.validateDiscriminator(schema);
      issues.push(...discriminatorIssues);
    }

    // Validate validation strategy
    if (schema.strategy && !Object.values(UnionValidationStrategy).includes(schema.strategy)) {
      issues.push({
        code: 'UNION_INVALID_STRATEGY',
        message: `Invalid validation strategy: ${schema.strategy}`,
        severity: 'error',
        fieldPath: 'strategy',
      });
    }

    // Validate discriminated union requirements
    if (schema.strategy === UnionValidationStrategy.discriminated && !schema.discriminator) {
      issues.push({
        code: 'UNION_DISCRIMINATED_NO_DISCRIMINATOR',
        message: 'Discriminated union strategy requires discriminator configuration',
        severity: 'error',
        fieldPath: 'strategy',
      });
    }

    // Validate type hints
    if (schema.typeHints) {
      for (let i = 0; i < schema.typeHints.length; i++) {
        const hint = schema.typeHints[i];
        if (hint && (hint.typeIndex < 0 || hint.typeIndex >= schema.unionTypes.length)) {
          issues.push({
            code: 'UNION_INVALID_TYPE_HINT_INDEX',
            message: `Type hint ${i} references invalid type index: ${hint.typeIndex}`,
            severity: 'error',
            fieldPath: `typeHints[${i}].typeIndex`,
          });
        }
      }
    }

    // Validate preferred type
    if (schema.preferredType !== undefined) {
      const preferredIndex = parseInt(schema.preferredType);
      if (!isNaN(preferredIndex) && (preferredIndex < 0 || preferredIndex >= schema.unionTypes.length)) {
        issues.push({
          code: 'UNION_INVALID_PREFERRED_TYPE',
          message: `Preferred type index ${preferredIndex} is out of range`,
          severity: 'error',
          fieldPath: 'preferredType',
        });
      }
    }

    // Check for conflicting configurations
    if (schema.strategy === UnionValidationStrategy.allValid && schema.allowAmbiguous === false) {
      issues.push({
        code: 'UNION_CONFLICTING_CONFIG',
        message: 'all_valid strategy conflicts with allowAmbiguous=false',
        severity: 'warning',
        fieldPath: 'strategy',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.filter((issue) => issue.severity === 'error').length === 0,
      issues,
    });
  }

  validateFieldValue(value: unknown, schema: UnionFieldSchema): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (value === undefined || value === null) {
      // Note: Required validation is handled at the processor level
      return ValidationResultCompatibilityUtil.createFromLegacy({
        isValid: true,
        issues,
      });
    }

    // Validate based on strategy
    const strategy = schema.strategy ?? UnionValidationStrategy.firstMatch;
    const typeMatchResults = this.analyzeTypeMatches(value, schema);

    switch (strategy) {
      case UnionValidationStrategy.oneOf:
        return this.validateStrict(value, schema, typeMatchResults, issues);

      case UnionValidationStrategy.firstMatch:
        return this.validateFirstMatch(value, schema, typeMatchResults, issues);

      case UnionValidationStrategy.anyOf:
        return this.validateAnyOf(value, schema, typeMatchResults, issues);

      case UnionValidationStrategy.bestMatch:
        return this.validateBestMatch(value, schema, typeMatchResults, issues);

      case UnionValidationStrategy.allValid:
        return this.validateAllValid(value, schema, typeMatchResults, issues);

      case UnionValidationStrategy.discriminated:
        return this.validateDiscriminated(value, schema, issues);

      default:
        return this.validateFirstMatch(value, schema, typeMatchResults, issues);
    }
  }

  private validateDiscriminator(schema: UnionFieldSchema): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const discriminator = schema.discriminator!;

    if (!discriminator.property) {
      issues.push({
        code: 'UNION_DISCRIMINATOR_NO_PROPERTY',
        message: 'Discriminator must have a property name',
        severity: 'error',
        fieldPath: 'discriminator.property',
      });
    }

    if (!discriminator.mapping || Object.keys(discriminator.mapping).length === 0) {
      issues.push({
        code: 'UNION_DISCRIMINATOR_NO_MAPPING',
        message: 'Discriminator must have mapping configuration',
        severity: 'error',
        fieldPath: 'discriminator.mapping',
      });
    }

    // Validate mapping indices
    if (discriminator.mapping) {
      for (const [key, typeIndex] of Object.entries(discriminator.mapping)) {
        if (typeIndex < 0 || typeIndex >= schema.unionTypes.length) {
          issues.push({
            code: 'UNION_DISCRIMINATOR_INVALID_INDEX',
            message: `Discriminator mapping "${key}" references invalid type index: ${typeIndex}`,
            severity: 'error',
            fieldPath: `discriminator.mapping.${key}`,
          });
        }
      }
    }

    return issues;
  }

  private analyzeTypeMatches(value: unknown, schema: UnionFieldSchema): TypeMatchAnalysis[] {
    return schema.unionTypes.map((typeSchema, index) => ({
      typeIndex: index,
      typeSchema: typeSchema as FieldSchema,
      matches: this.checkTypeMatch(value, typeSchema as FieldSchema),
      confidence: this.calculateTypeConfidence(value, typeSchema as FieldSchema),
    }));
  }

  private checkTypeMatch(value: unknown, typeSchema: FieldSchema): boolean {
    // Basic type matching logic
    switch (typeSchema.type) {
      case FieldType.string:
        return typeof value === 'string';
      case FieldType.number:
        return typeof value === 'number' && !isNaN(value);
      case FieldType.boolean:
        return typeof value === 'boolean';
      case FieldType.array:
        return Array.isArray(value);
      case FieldType.object:
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case FieldType.date:
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      default:
        return false;
    }
  }

  private calculateTypeConfidence(value: unknown, typeSchema: FieldSchema): number {
    // Basic confidence scoring
    switch (typeSchema.type) {
      case FieldType.string:
        return typeof value === 'string' ? 0.9 : 0;
      case FieldType.number:
        return typeof value === 'number' ? 0.9 : 0;
      case FieldType.boolean:
        return typeof value === 'boolean' ? 0.9 : 0;
      case FieldType.array:
        return Array.isArray(value) ? 0.8 : 0;
      case FieldType.object:
        return typeof value === 'object' && value !== null && !Array.isArray(value) ? 0.7 : 0;
      default:
        // For unknown or unsupported types, return default confidence
        return 0.5;
    }
  }

  private validateStrict(value: unknown, schema: UnionFieldSchema, matches: TypeMatchAnalysis[], issues: ValidationIssue[]): ValidationResult {
    const validMatches = matches.filter((m) => m.matches);

    if (validMatches.length === 0) {
      issues.push({
        code: 'UNION_NO_MATCH',
        message: 'Value does not match any union type',
        severity: 'error',
        fieldPath: 'value',
      });
    } else if (validMatches.length > 1 && !schema.allowAmbiguous) {
      issues.push({
        code: 'UNION_AMBIGUOUS_MATCH',
        message: `Value matches multiple types (${validMatches.map((m) => m.typeIndex).join(', ')}) but ambiguous matches are not allowed`,
        severity: 'error',
        fieldPath: 'value',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.length === 0,
      issues,
    });
  }

  private validateFirstMatch(value: unknown, schema: UnionFieldSchema, matches: TypeMatchAnalysis[], issues: ValidationIssue[]): ValidationResult {
    const firstMatch = matches.find((m) => m.matches);

    if (!firstMatch) {
      issues.push({
        code: 'UNION_NO_MATCH',
        message: 'Value does not match any union type',
        severity: 'error',
        fieldPath: 'value',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.length === 0,
      issues,
    });
  }

  private validateAnyOf(value: unknown, schema: UnionFieldSchema, matches: TypeMatchAnalysis[], issues: ValidationIssue[]): ValidationResult {
    const validMatches = matches.filter((m) => m.matches);

    if (validMatches.length === 0) {
      issues.push({
        code: 'UNION_NO_MATCH',
        message: 'Value does not match any union type',
        severity: 'error',
        fieldPath: 'value',
      });
    }

    // anyOf strategy: accept if matches any type (similar to firstMatch but explicit)
    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.length === 0,
      issues,
    });
  }

  private validateBestMatch(value: unknown, schema: UnionFieldSchema, matches: TypeMatchAnalysis[], issues: ValidationIssue[]): ValidationResult {
    const validMatches = matches.filter((m) => m.matches);

    if (validMatches.length === 0) {
      issues.push({
        code: 'UNION_NO_MATCH',
        message: 'Value does not match any union type',
        severity: 'error',
        fieldPath: 'value',
      });
    } else {
      const bestMatch = validMatches.reduce((best, current) => (current.confidence > best.confidence ? current : best));

      if (bestMatch.confidence < 0.5) {
        issues.push({
          code: 'UNION_LOW_CONFIDENCE_MATCH',
          message: `Best type match has low confidence (${bestMatch.confidence})`,
          severity: 'warning',
          fieldPath: 'value',
        });
      }
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.length === 0,
      issues,
    });
  }

  private validateAllValid(value: unknown, schema: UnionFieldSchema, matches: TypeMatchAnalysis[], issues: ValidationIssue[]): ValidationResult {
    const invalidMatches = matches.filter((m) => !m.matches);

    if (invalidMatches.length > 0) {
      issues.push({
        code: 'UNION_NOT_ALL_VALID',
        message: `Value must be valid for all union types. Invalid for types: ${invalidMatches.map((m) => m.typeIndex).join(', ')}`,
        severity: 'error',
        fieldPath: 'value',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.length === 0,
      issues,
    });
  }

  private validateDiscriminated(value: unknown, schema: UnionFieldSchema, issues: ValidationIssue[]): ValidationResult {
    if (!schema.discriminator) {
      issues.push({
        code: 'UNION_DISCRIMINATED_NO_CONFIG',
        message: 'Discriminated validation requires discriminator configuration',
        severity: 'error',
        fieldPath: 'discriminator',
      });
      return ValidationResultCompatibilityUtil.createFromLegacy({
        isValid: false,
        issues,
      });
    }

    if (typeof value !== 'object' || value === null) {
      issues.push({
        code: 'UNION_DISCRIMINATED_NOT_OBJECT',
        message: 'Discriminated union value must be an object',
        severity: 'error',
        fieldPath: 'value',
      });
      return ValidationResultCompatibilityUtil.createFromLegacy({
        isValid: false,
        issues,
      });
    }

    const discriminatorValue = (value as Record<string, unknown>)[schema.discriminator.property] as string | undefined;

    if (discriminatorValue === undefined) {
      if (schema.discriminator.required !== false) {
        issues.push({
          code: 'UNION_DISCRIMINATOR_MISSING',
          message: `Discriminator property "${schema.discriminator.property}" is required`,
          severity: 'error',
          fieldPath: 'value',
        });
      }
    } else {
      const typeIndex = schema.discriminator.mapping[discriminatorValue];
      if (typeIndex === undefined) {
        issues.push({
          code: 'UNION_DISCRIMINATOR_INVALID_VALUE',
          message: `Invalid discriminator value: ${discriminatorValue}`,
          severity: 'error',
          fieldPath: `value.${schema.discriminator.property}`,
        });
      } else if (typeIndex < 0 || typeIndex >= schema.unionTypes.length) {
        issues.push({
          code: 'UNION_DISCRIMINATOR_INDEX_OUT_OF_RANGE',
          message: `Discriminator maps to invalid type index: ${typeIndex}`,
          severity: 'error',
          fieldPath: `value.${schema.discriminator.property}`,
        });
      }
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: issues.length === 0,
      issues,
    });
  }

  validateStructure(schema: UnionFieldSchema): ValidationResult {
    // For now, delegate to validateFieldSchema
    return this.validateFieldSchema(schema);
  }

  validateConstraints(schema: UnionFieldSchema, context: ValidationContext): ValidationResult {
    // For now, delegate to validateFieldValue using the data from context
    return this.validateFieldValue(context.data, schema);
  }
}

interface TypeMatchAnalysis {
  typeIndex: number;
  typeSchema: FieldSchema;
  matches: boolean;
  confidence: number;
}
