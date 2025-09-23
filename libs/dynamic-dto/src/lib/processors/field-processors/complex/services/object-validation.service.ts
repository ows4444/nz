import { Injectable } from '@nestjs/common';
import type { FieldSchema } from '../../../../core/interfaces/schema';
import type { ObjectFieldSchema } from '../../../../core/interfaces/schema/complex/object-field.schema';
import { FieldType } from '../../../../core/types/field.types';

@Injectable()
export class ObjectValidationService {
  performDeepValidation(value: Record<string, unknown>, schema: ObjectFieldSchema): Record<string, unknown> {
    if (!schema.properties) {
      return value;
    }

    const result: Record<string, unknown> = { ...value };
    const requiredFields = new Set(schema.required ?? []);

    this.validateRequiredFields(result, requiredFields);
    this.validateProperties(result, schema.properties as Record<string, FieldSchema>);

    return result;
  }

  private validateRequiredFields(value: Record<string, unknown>, requiredFields: Set<string>): void {
    for (const requiredField of requiredFields) {
      if (!(requiredField in value)) {
        throw new Error(`Required field '${requiredField}' is missing`);
      }
    }
  }

  private validateProperties(value: Record<string, unknown>, properties: Record<string, FieldSchema>): void {
    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      const propertyValue = value[propertyName];

      if (propertyValue !== undefined && propertyValue !== null) {
        value[propertyName] = this.validateProperty(propertyValue, propertySchema, propertyName);
      }
    }
  }

  private validateProperty(value: unknown, schema: FieldSchema, propertyName: string): unknown {
    switch (schema.type) {
      case FieldType.string:
        return this.validateStringProperty(value, propertyName);
      case FieldType.number:
        return this.validateNumberProperty(value, propertyName);
      case FieldType.boolean:
        return this.validateBooleanProperty(value, propertyName);
      case FieldType.array:
        return this.validateArrayProperty(value, propertyName);
      case FieldType.object:
        return this.validateObjectProperty(value, schema, propertyName);
      default:
        return value;
    }
  }

  private validateStringProperty(value: unknown, propertyName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`Property '${propertyName}' must be a string, got ${typeof value}`);
    }
    return value;
  }

  private validateNumberProperty(value: unknown, propertyName: string): number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`Property '${propertyName}' must be a valid number, got ${typeof value}`);
    }
    return value;
  }

  private validateBooleanProperty(value: unknown, propertyName: string): boolean {
    if (typeof value !== 'boolean') {
      throw new Error(`Property '${propertyName}' must be a boolean, got ${typeof value}`);
    }
    return value;
  }

  private validateArrayProperty(value: unknown, propertyName: string): unknown[] {
    if (!Array.isArray(value)) {
      throw new Error(`Property '${propertyName}' must be an array, got ${typeof value}`);
    }
    return value;
  }

  private validateObjectProperty(value: unknown, schema: ObjectFieldSchema, propertyName: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Property '${propertyName}' must be an object, got ${Array.isArray(value) ? 'array' : typeof value}`);
    }

    // Recursive validation for nested objects
    if ('properties' in schema && schema.properties) {
      return this.performDeepValidation(value as Record<string, unknown>, schema);
    }

    return value as Record<string, unknown>;
  }
}
