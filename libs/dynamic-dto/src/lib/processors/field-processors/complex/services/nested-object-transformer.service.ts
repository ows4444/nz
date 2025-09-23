import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import type { FieldSchema } from '../../../../core/interfaces/schema';
import type { ObjectFieldSchema } from '../../../../core/interfaces/schema/complex/object-field.schema';
import { NestedClassGeneratorService } from '../../../../infrastructure/services/nested-class-generator.service';

@Injectable()
export class NestedObjectTransformerService {
  constructor(private readonly nestedClassGenerator: NestedClassGeneratorService) {}

  generateNestedClassDecorator(schema: ObjectFieldSchema): PropertyDecorator | null {
    if (!schema.properties) {
      return null;
    }

    const nestedClass = this.nestedClassGenerator.generateNestedClass(schema.properties as Record<string, FieldSchema>, [...(schema.required ?? [])], schema.exclude ?? false);

    return Type(() => nestedClass);
  }

  prepareNestedClassGeneration(schema: ObjectFieldSchema): void {
    if (schema.properties) {
      // Pre-generate the nested class for transformation purposes
      this.nestedClassGenerator.generateNestedClass(schema.properties as Record<string, FieldSchema>, [...(schema.required ?? [])], schema.exclude ?? false);
    }
  }

  validateNestedStructure(value: Record<string, unknown>, schema: ObjectFieldSchema): Record<string, unknown> {
    if (!schema.properties || !value || typeof value !== 'object') {
      return value;
    }

    // Basic structure validation - detailed validation is handled by ObjectValidationService
    const result: Record<string, unknown> = { ...value };

    // Ensure nested objects exist for required fields
    for (const fieldName of schema.required ?? []) {
      if (!(fieldName in result)) {
        const fieldSchema = schema.properties[fieldName];
        if (fieldSchema?.type === 'object' && fieldSchema.default) {
          result[fieldName] = fieldSchema.default;
        }
      }
    }

    return result;
  }
}
