import type { FieldSchema } from '../schema';
import type { FieldTypeValue } from '../../types/field.types';
import type { ValidationContext, ValidationResult } from '../validation';
import type { ClassConstructor } from '../../types/common.types';

export interface IFieldProcessingMediator {
  // Field processing operations
  processField(fieldSchema: FieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[];
  canProcessField(fieldType: FieldTypeValue): boolean;
  getSupportedTypes(): FieldTypeValue[];

  // Nested class generation
  generateNestedClass(properties: Record<string, FieldSchema>, required?: string[], exclude?: boolean): ClassConstructor<object>;

  // Field validation
  validateField(fieldSchema: FieldSchema, context?: ValidationContext): ValidationResult;
}
