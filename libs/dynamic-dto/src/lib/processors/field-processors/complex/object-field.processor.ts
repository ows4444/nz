import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDefined, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { BaseFieldProcessor } from '../../../core/abstractions/base-field-processor.abstract';
import { type TransformationFunction } from '../../../core/abstractions/transformation-processor.abstract';
import type { FieldSchema } from '../../../core/interfaces/schema';
import type { ObjectFieldSchema } from '../../../core/interfaces/schema/complex/object-field.schema';
import { FieldType } from '../../../core/types/field.types';
import { NestedClassGeneratorService } from '../../../infrastructure/services/nested-class-generator.service';

// Circular reference tracking interface
interface CircularReferenceContext {
  visited: WeakSet<Record<string, unknown>>;
  path: string[];
  maxDepth: number;
  currentDepth: number;
}

@Injectable()
export class ObjectFieldProcessor extends BaseFieldProcessor<ObjectFieldSchema> {
  readonly supportedType = FieldType.object;
  private static readonly DEFAULT_MAX_DEPTH = 10;

  constructor(private readonly nestedClassGenerator: NestedClassGeneratorService) {
    super();
  }

  canProcess(schema: FieldSchema): schema is ObjectFieldSchema {
    return schema.type === FieldType.object;
  }

  generateValidationDecorators(schema: ObjectFieldSchema, isRequired: boolean, parentIsArray = false): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const options = parentIsArray ? { each: true } : undefined;

    if (isRequired) {
      decorators.push(IsDefined(options));
    } else {
      decorators.push(IsOptional(options));
    }

    decorators.push(IsObject(options));
    decorators.push(ValidateNested(options));

    return decorators;
  }

  getTypeSpecificTransformations(schema: ObjectFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Circular reference detection (order: 10)
    functions.push({
      order: 10,
      name: 'circular_reference_check',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;

        const context: CircularReferenceContext = {
          visited: new WeakSet(),
          path: [],
          maxDepth: ObjectFieldProcessor.DEFAULT_MAX_DEPTH,
          currentDepth: 0,
        };

        return this.detectAndHandleCircularReferences(value as Record<string, unknown>, context);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // Deep validation check (order: 20)
    functions.push({
      order: 20,
      name: 'deep_validation',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.performDeepValidation(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // Nested class transformation (order: 30)
    if (schema.properties) {
      this.nestedClassGenerator.generateNestedClass(schema.properties as Record<string, FieldSchema>, [...(schema.required ?? [])], schema.exclude ?? false);

      functions.push({
        order: 30,
        name: 'nested_class',
        transform: ({ value }) => value, // Type decorator handles the transformation
      });

      // This is handled by the Type decorator, but we track it here for completeness
    }

    // Property filtering based on permissions (order: 40)
    functions.push({
      order: 40,
      name: 'property_filtering',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.filterPropertiesByPermissions(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // Additional properties handling (order: 50)
    if (schema.additionalProperties === false) {
      functions.push({
        order: 50,
        name: 'additional_properties',
        transform: ({ value }) => {
          if (!value || typeof value !== 'object') return value;
          return this.removeAdditionalProperties(value as Record<string, unknown>, schema);
        },
        condition: (_, { value }) => Boolean(value && typeof value === 'object'),
      });
    }

    // Property validation and transformation (order: 60)
    functions.push({
      order: 60,
      name: 'property_transformation',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.transformObjectProperties(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    return functions;
  }

  public generateEnhancedTransformationDecorators(schema: ObjectFieldSchema): PropertyDecorator[] {
    const decorators = super.generateTransformationDecorators(schema);

    // Add Type decorator for nested class generation
    if (schema.properties) {
      const nestedClass = this.nestedClassGenerator.generateNestedClass(schema.properties as Record<string, FieldSchema>, [...(schema.required ?? [])], schema.exclude ?? false);
      decorators.unshift(Type(() => nestedClass));
    }

    return decorators;
  }

  private filterPropertiesByPermissions(value: Record<string, unknown>, _schema: ObjectFieldSchema): Record<string, unknown> {
    // Implementation for permission-based property filtering
    return value;
  }

  private removeAdditionalProperties(value: Record<string, unknown>, schema: ObjectFieldSchema): Record<string, unknown> {
    const allowedKeys = new Set(Object.keys(schema.properties));
    const filtered: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (allowedKeys.has(key)) {
        filtered[key] = val;
      }
    }

    return filtered;
  }

  private transformObjectProperties(value: Record<string, unknown>, _schema: ObjectFieldSchema): Record<string, unknown> {
    // Apply property-level transformations
    return value;
  }

  /**
   * Detects and handles circular references in nested objects
   */
  private detectAndHandleCircularReferences(value: Record<string, unknown>, context: CircularReferenceContext): Record<string, unknown> {
    // Check depth limit
    if (context.currentDepth >= context.maxDepth) {
      throw new Error(`Maximum nesting depth (${context.maxDepth}) exceeded at path: ${context.path.join('.')}`);
    }

    // Check for circular reference
    if (context.visited.has(value)) {
      throw new Error(`Circular reference detected at path: ${context.path.join('.')}`);
    }

    // Mark as visited
    context.visited.add(value);

    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      const newPath = [...context.path, key];
      const newContext: CircularReferenceContext = {
        ...context,
        path: newPath,
        currentDepth: context.currentDepth + 1,
      };

      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = this.detectAndHandleCircularReferences(val as Record<string, unknown>, newContext);
      } else if (Array.isArray(val)) {
        result[key] = val.map((item, index) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return this.detectAndHandleCircularReferences(item as Record<string, unknown>, {
              ...newContext,
              path: [...newPath, index.toString()],
            });
          }
          return item;
        });
      } else {
        result[key] = val;
      }
    }

    return result;
  }

  /**
   * Performs deep validation of nested object structures
   */
  private performDeepValidation(value: Record<string, unknown>, schema: ObjectFieldSchema): Record<string, unknown> {
    if (!schema.properties) {
      return value;
    }

    const result: Record<string, unknown> = { ...value };
    const requiredFields = new Set(schema.required || []);

    // Validate required fields exist
    for (const requiredField of requiredFields) {
      if (!(requiredField in result)) {
        throw new Error(`Required field '${requiredField}' is missing`);
      }
    }

    // Validate each property against its schema
    for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
      const propertyValue = result[propertyName];

      if (propertyValue !== undefined && propertyValue !== null) {
        result[propertyName] = this.validateProperty(propertyValue, propertySchema as FieldSchema, propertyName);
      }
    }

    return result;
  }

  /**
   * Validates individual property based on its schema
   */
  private validateProperty(value: unknown, schema: FieldSchema, propertyName: string): unknown {
    // Type-specific validation
    switch (schema.type) {
      case FieldType.string:
        if (typeof value !== 'string') {
          throw new Error(`Property '${propertyName}' must be a string, got ${typeof value}`);
        }
        break;
      case FieldType.number:
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Property '${propertyName}' must be a valid number, got ${typeof value}`);
        }
        break;
      case FieldType.boolean:
        if (typeof value !== 'boolean') {
          throw new Error(`Property '${propertyName}' must be a boolean, got ${typeof value}`);
        }
        break;
      case FieldType.array:
        if (!Array.isArray(value)) {
          throw new Error(`Property '${propertyName}' must be an array, got ${typeof value}`);
        }
        break;
      case FieldType.object:
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(`Property '${propertyName}' must be an object, got ${Array.isArray(value) ? 'array' : typeof value}`);
        }
        // Recursive validation for nested objects
        if ('properties' in schema) {
          return this.performDeepValidation(value as Record<string, unknown>, schema);
        }
        break;
    }

    return value;
  }
}
