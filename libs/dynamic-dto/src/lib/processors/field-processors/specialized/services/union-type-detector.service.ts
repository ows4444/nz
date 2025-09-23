import { Injectable } from '@nestjs/common';
import { FieldType } from '../../../../core/types/field.types';
import type { FieldSchema } from '../../../../core/interfaces/schema';
import { TypeCondition, TypeHint, UnionFieldSchema } from '../../../../core/interfaces/schema/specialized-primitives/union-field.schema';
import { UnionValidatorRegistry } from './union-validator-registry.service';

/**
 * Service responsible for detecting and resolving union types based on value analysis.
 * Separated from the main processor to follow Single Responsibility Principle.
 */
@Injectable()
export class UnionTypeDetectorService {
  constructor(private readonly validatorRegistry: UnionValidatorRegistry) {}

  /**
   * Detects the most appropriate union type for a given value
   * @param value The value to analyze
   * @param schema The union schema containing type options
   * @returns The index of the detected type, or -1 if no type matches
   */
  detectUnionType(value: unknown, schema: UnionFieldSchema): number {
    if (schema.typeHints && schema.typeHints.length > 0) {
      // Use type hints for more accurate detection
      const hintBasedType = this.detectTypeFromHints(value, [...schema.typeHints]);
      if (hintBasedType >= 0) {
        return hintBasedType;
      }
    }

    // Fall back to confidence-based detection
    return this.detectTypeByConfidence(value, schema);
  }

  /**
   * Calculates confidence score for a value against a specific type schema
   * @param value The value to analyze
   * @param typeSchema The type schema to match against
   * @param typeHints Additional hints to improve accuracy
   * @returns Confidence score between 0 and 1
   */
  calculateTypeConfidence(value: unknown, typeSchema: FieldSchema, typeHints: readonly TypeHint[]): number {
    let confidence = this.getBasicTypeConfidence(value, typeSchema.type);

    // Apply type hints to adjust confidence
    for (const hint of typeHints) {
      if (this.matchesTypeCondition(value, hint.condition)) {
        const hintWeight = (hint.weight ?? 1) * 0.2;
        confidence = Math.min(1, confidence + hintWeight);
      }
    }

    return confidence;
  }

  /**
   * Determines if a value matches a specific type condition
   * @param value The value to test
   * @param condition The condition to evaluate
   * @returns True if the condition is met
   */
  matchesTypeCondition(value: unknown, condition: TypeCondition): boolean {
    switch (condition.type) {
      case 'property':
        return this.hasProperty(value, condition.property);
      case 'value':
        return value === condition.value;
      case 'pattern':
        return this.matchesPattern(value, condition.pattern);
      case 'custom':
        return this.evaluateCustomValidator(value, condition);
      default:
        return false;
    }
  }

  /**
   * Detects union type using type hints
   * @param value The value to analyze
   * @param typeHints Array of type hints
   * @returns Type index or -1 if no hint matches
   */
  private detectTypeFromHints(value: unknown, typeHints: TypeHint[]): number {
    for (const hint of typeHints) {
      if (this.matchesTypeCondition(value, hint.condition)) {
        return hint.typeIndex;
      }
    }
    return -1;
  }

  /**
   * Detects type by calculating confidence for all possible types
   * @param value The value to analyze
   * @param schema The union schema
   * @returns Type index with highest confidence above threshold
   */
  private detectTypeByConfidence(value: unknown, schema: UnionFieldSchema): number {
    let bestTypeIndex = -1;
    let bestConfidence = 0.5; // Minimum confidence threshold

    for (let i = 0; i < schema.unionTypes.length; i++) {
      const typeSchema = schema.unionTypes[i] as FieldSchema;
      const confidence = this.calculateTypeConfidence(value, typeSchema, [...(schema.typeHints ?? [])]);

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestTypeIndex = i;
      }
    }

    return bestTypeIndex;
  }

  /**
   * Gets basic confidence based on JavaScript type matching
   * @param value The value to analyze
   * @param fieldType The expected field type
   * @returns Basic confidence score
   */
  private getBasicTypeConfidence(value: unknown, fieldType: (typeof FieldType)[keyof typeof FieldType]): number {
    switch (fieldType) {
      case FieldType.string:
        return typeof value === 'string' ? 0.8 : 0;
      case FieldType.number:
        return typeof value === 'number' ? 0.8 : 0;
      case FieldType.boolean:
        return typeof value === 'boolean' ? 0.8 : 0;
      case FieldType.object:
        return typeof value === 'object' && value !== null && !Array.isArray(value) ? 0.7 : 0;
      case FieldType.array:
        return Array.isArray(value) ? 0.7 : 0;
      default:
        return 0.1;
    }
  }

  /**
   * Checks if a value has a specific property
   * @param value The value to check
   * @param property The property name
   * @returns True if property exists
   */
  private hasProperty(value: unknown, property?: string): boolean {
    if (!property || typeof value !== 'object' || value === null) {
      return false;
    }
    return property in value;
  }

  /**
   * Checks if a string value matches a pattern
   * @param value The value to test
   * @param pattern The regex pattern
   * @returns True if pattern matches
   */
  private matchesPattern(value: unknown, pattern?: string | RegExp): boolean {
    if (!pattern || typeof value !== 'string') {
      return false;
    }

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return regex.test(value);
  }

  /**
   * Evaluates custom validators safely
   * @param value The value to validate
   * @param condition The type condition with validator info
   * @returns True if validator passes
   */
  private evaluateCustomValidator(value: unknown, condition: TypeCondition): boolean {
    if (!condition.validatorName) {
      return false;
    }

    const validator = this.validatorRegistry.getValidator(condition.validatorName);
    if (!validator) {
      // Log warning only in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Custom validator '${condition.validatorName}' not found`);
      }
      return false;
    }

    try {
      return validator(value, condition.validatorConfig);
    } catch (error) {
      // Log error only in development
      if (process.env.NODE_ENV === 'development') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error executing custom validator '${condition.validatorName}':`, errorMessage);
      }
      return false;
    }
  }
}
