import { Injectable } from '@nestjs/common';
import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import type { FieldSchema } from '../interfaces/schema';
import type { SerializableCondition } from '../interfaces/schema/base/base-field.schema';

export interface FieldValidationService {
  generateValidationDecorators(schema: FieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[];
}

@Injectable()
export class DefaultFieldValidationService implements FieldValidationService {
  generateValidationDecorators(schema: FieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Basic required/optional validation
    if (isRequired && !parentIsArray) {
      decorators.push(IsNotEmpty());
    } else {
      decorators.push(IsOptional());
    }

    // Conditional validation based on schema conditions
    if (schema.conditionalValidation && schema.conditionalValidation.length > 0) {
      const condition = this.buildConditionalFunction(schema.conditionalValidation[0]);
      decorators.push(ValidateIf(condition));
    }

    return decorators;
  }

  private buildConditionalFunction(conditional: unknown): (obj: unknown) => boolean {
    return (obj: unknown) => {
      // If conditional is a function, execute it
      if (typeof conditional === 'function') {
        try {
          const result = conditional(obj);
          return Boolean(result);
        } catch (error) {
          // If condition function fails, default to not validating (false)
          console.warn('Conditional validation function failed:', error);
          return false;
        }
      }

      // If conditional is a serializable condition object, evaluate it
      if (conditional && typeof conditional === 'object' && 'field' in conditional) {
        return this.evaluateSerializableCondition(conditional as SerializableCondition, obj);
      }

      // If conditional is a boolean, return it directly
      if (typeof conditional === 'boolean') {
        return conditional;
      }

      // If conditional is null/undefined, default to not validating
      if (conditional == null) {
        return false;
      }

      // For any other type, convert to boolean (but log a warning)
      console.warn('Unexpected conditional validation type:', typeof conditional, conditional);
      return Boolean(conditional);
    };
  }

  private evaluateSerializableCondition(condition: SerializableCondition, obj: unknown): boolean {
    if (!condition || !obj || typeof obj !== 'object') {
      return false;
    }

    const objRecord = obj as Record<string, unknown>;
    const fieldValue = objRecord[condition.field];

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
      case 'gte':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
      case 'lt':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
      case 'lte':
        return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'exists':
        return condition.field in objRecord;
      case 'regex':
        return typeof fieldValue === 'string' && typeof condition.value === 'string' && new RegExp(condition.value).test(fieldValue);
      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2 && typeof fieldValue === 'number') {
          const [min, max] = condition.value as [number, number];
          return fieldValue >= min && fieldValue <= max;
        }
        return false;
      default:
        console.warn('Unknown condition operator:', condition.operator);
        return false;
    }
  }
}
