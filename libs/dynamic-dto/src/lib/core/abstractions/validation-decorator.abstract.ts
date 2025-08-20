import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import type { ConditionalValidation, FieldSchema, SerializableCondition } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import { ValidationStrategy } from '../enums/validation.enums';

export interface SerializationContext {
  userRoles?: string[];
  operation?: 'create' | 'read' | 'update' | 'delete';
  includeHidden?: boolean;
  includeDeprecated?: boolean;
  locale?: string;
  userId?: string;
  version?: string;
}

export abstract class ValidationDecorator<T extends FieldSchema = FieldSchema> {
  abstract readonly supportedType: FieldTypeValue;

  abstract canProcess(schema: FieldSchema): schema is T;
  abstract generateValidationDecorators(schema: T, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[];

  public generateEnhancedValidationDecorators(schema: T, isRequired: boolean): PropertyDecorator[] {
    const decorators = [...this.generateValidationDecorators(schema, isRequired), ...this.generateConditionalValidationDecorators(schema)];

    if (schema.nullable) decorators.push(...this.createNullableValidation());
    if (isRequired && !schema.readonly) decorators.push(IsNotEmpty({ message: this.getValidationMessage(schema, 'required') }));
    else if (!isRequired) decorators.push(IsOptional());

    if ('customValidators' in schema && schema.customValidators?.length) {
      decorators.push(...this.generateCustomValidationDecorators(schema.customValidators));
    }

    decorators.push(...this.generateValidationStrategyDecorators(schema));
    return decorators;
  }

  public generateConditionalValidationDecorators(schema: T): PropertyDecorator[] {
    if (!('conditionalValidation' in schema) || !schema.conditionalValidation) return [];
    return (schema.conditionalValidation as ConditionalValidation[]).map((condition) => this.createConditionalValidator(condition));
  }

  protected createNullableValidation(): PropertyDecorator[] {
    return [ValidateIf((_, val) => val !== null)];
  }

  protected generateCustomValidationDecorators(customValidators: readonly string[]): PropertyDecorator[] {
    return customValidators.map(() => ValidateIf(() => true));
  }

  protected generateValidationStrategyDecorators(schema: T): PropertyDecorator[] {
    if (!('validationStrategy' in schema)) return [];

    switch (schema.validationStrategy) {
      case ValidationStrategy.loose:
        return [IsOptional()];
      case ValidationStrategy.strict:
      case ValidationStrategy.transform:
      case ValidationStrategy.sanitize:
      default:
        return [];
    }
  }

  protected createConditionalValidator(condition: ConditionalValidation): PropertyDecorator {
    return ValidateIf((obj: Record<string, unknown>) => this.evaluateCondition(condition.condition, obj));
  }

  protected evaluateCondition(condition: SerializableCondition, obj: Record<string, unknown>): boolean {
    const value = this.getNestedValue(obj, condition.field);
    let result = this.evaluateSingleCondition(condition, value);

    if ('nested' in condition && condition.nested?.length) {
      const nestedResults = condition.nested.map((n) => this.evaluateCondition(n, obj));
      result = condition.logicalOperator === 'and' ? result && nestedResults.every(Boolean) : result || nestedResults.some(Boolean);
    }

    return result;
  }

  protected evaluateSingleCondition(condition: SerializableCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'exists':
        return value != null;
      case 'regex':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return true;
    }
  }

  protected getValidationMessage(schema: T, type: string): string {
    return `Field ${schema.type} validation failed for ${type}`;
  }

  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((val: any, key) => val?.[key], obj);
  }
}
