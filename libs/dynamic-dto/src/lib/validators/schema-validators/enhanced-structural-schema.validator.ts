import { Injectable } from '@nestjs/common';
import { BaseSchemaValidator } from '../../core/abstractions/base-schema-validator.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { FieldHandlerRegistry } from '../../infrastructure/registries/field-handler.registry';
import { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import { ValidationResultMerger } from '../../core/utils/validation-result-merger';
import { FieldType } from '../../core/types/field.types';
import { ObjectFieldSchema } from '../../core/interfaces/schema/complex/object-field.schema';
import { ValidationResultCompatibilityUtil } from '../../core/utils/validation-result-compatibility.util';

@Injectable()
export class EnhancedStructuralSchemaValidator extends BaseSchemaValidator {
  constructor(private readonly fieldHandlerRegistry: FieldHandlerRegistry) {
    super();
  }

  validate(schema: Record<string, FieldSchema>, data?: unknown, context = ''): ValidationResult {
    return this.validateSchemaObject(schema, context, data);
  }

  private validateSchemaObject(schema: Record<string, FieldSchema>, context: string, data?: unknown): ValidationResult {
    const results: ValidationResult[] = [];

    // Enhanced schema structure validation with integrity checks
    results.push(this.validateSchemaStructure(schema, context));

    // Only validate integrity if schema is valid
    if (schema && typeof schema === 'object') {
      results.push(this.validateSchemaIntegrity(schema, context));
      // Validate circular references in schema definitions
      results.push(this.validateCircularReferences(schema, context));
    }

    // Validate individual fields using both BaseSchemaValidator and FieldValidatorRegistry
    if (schema && typeof schema === 'object') {
      for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const fieldPath = context ? `${context}.${fieldName}` : fieldName;
        const validationContext: ValidationContext = {
          fieldPath,
          depth: context.split('.').filter(Boolean).length,
          parentType: fieldSchema.type,
          data,
        };

        // Use enhanced validateFieldSchema from BaseSchemaValidator
        const baseValidationResult = this.validateFieldSchema(fieldName, fieldSchema, validationContext);
        results.push(baseValidationResult);

        // Use field-specific validation from registry
        const registryResult = this.fieldHandlerRegistry.validateField(fieldSchema, validationContext);
        results.push(registryResult);
      }
    }

    return ValidationResultMerger.mergeResults(results);
  }

  private validateSchemaStructure(schema: Record<string, FieldSchema>, context: string): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!schema || typeof schema !== 'object') {
      errors.push({
        message: `Schema at ${context || 'root'} must be an object`,
        fieldPath: context,
        code: 'INVALID_SCHEMA_STRUCTURE',
        severity: 'error',
      });
      return ValidationResultCompatibilityUtil.createFromLegacy({
        isValid: false,
        issues: errors,
      });
    }

    if (Object.keys(schema).length === 0) {
      warnings.push({
        message: `Schema at ${context || 'root'} is empty`,
        fieldPath: context,
        code: 'EMPTY_SCHEMA',
        severity: 'warning',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: errors.length === 0,
      issues: [...errors, ...warnings],
    });
  }

  /**
   * Validates schema definitions for circular references that could cause infinite loops during DTO generation
   */
  private validateCircularReferences(schema: Record<string, FieldSchema>, context: string): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const maxDepth = 50; // Prevent stack overflow during validation

    const validateReferences = (currentSchema: Record<string, FieldSchema>, path: string[], depth: number): void => {
      if (depth > maxDepth) {
        errors.push({
          message: `Maximum schema validation depth (${maxDepth}) exceeded at path: ${path.join('.')}`,
          fieldPath: path.join('.'),
          code: 'MAX_SCHEMA_DEPTH_EXCEEDED',
          severity: 'error',
        });
        return;
      }

      const currentPath = path.join('.');

      if (recursionStack.has(currentPath)) {
        errors.push({
          message: `Circular reference detected in schema definition at path: ${currentPath}`,
          fieldPath: currentPath,
          code: 'CIRCULAR_SCHEMA_REFERENCE',
          severity: 'error',
        });
        return;
      }

      if (visited.has(currentPath)) {
        return; // Already validated this path
      }

      visited.add(currentPath);
      recursionStack.add(currentPath);

      this.validateObjectFields(
        currentSchema,
        path,
        schema,
        (fieldPath) => {
          warnings.push({
            message: `Potential circular reference detected: field "${fieldPath.propName}" at path "${fieldPath.propPath.join('.')}" may reference parent schema "${fieldPath.parentPath.join('.')}"`,
            fieldPath: fieldPath.propPath.join('.'),
            code: 'POTENTIAL_CIRCULAR_REFERENCE',
            severity: 'warning',
          });
        },
        (properties, newPath) => {
          validateReferences(properties as Record<string, FieldSchema>, newPath, depth + 1);
        }
      );

      recursionStack.delete(currentPath);
    };

    try {
      validateReferences(schema, context ? context.split('.').filter(Boolean) : [], 0);
    } catch (error) {
      errors.push({
        message: `Error during circular reference validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fieldPath: context,
        code: 'CIRCULAR_VALIDATION_ERROR',
        severity: 'error',
      });
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: errors.length === 0,
      issues: [...errors, ...warnings],
    });
  }

  /**
   * Helper method to validate object fields and detect circular references
   */
  private validateObjectFields(
    currentSchema: Record<string, FieldSchema>,
    path: string[],
    rootSchema: Record<string, FieldSchema>,
    onPotentialCircular: (fieldPath: { propName: string; propPath: string[]; parentPath: string[] }) => void,
    onRecurse: (properties: unknown, newPath: string[]) => void
  ): void {
    for (const [fieldName, fieldSchema] of Object.entries(currentSchema)) {
      const fieldPath = [...path, fieldName];

      if (fieldSchema.type === FieldType.object) {
        const objectSchema = fieldSchema;

        if (objectSchema.properties) {
          // Check for potential circular references
          this.checkForCircularReferences(objectSchema.properties as unknown, fieldPath, path, rootSchema, onPotentialCircular);

          // Recursively validate nested object properties
          onRecurse(objectSchema.properties, fieldPath);
        }
      } else if (fieldSchema.type === FieldType.array) {
        this.validateArrayItemCircularReferences(fieldSchema, fieldPath, onRecurse);
      }
    }
  }

  private checkForCircularReferences(
    properties: unknown,
    fieldPath: string[],
    path: string[],
    rootSchema: Record<string, FieldSchema>,
    onPotentialCircular: (fieldPath: { propName: string; propPath: string[]; parentPath: string[] }) => void
  ): void {
    const props = properties as Record<string, FieldSchema>;
    for (const [propName, propSchema] of Object.entries(props)) {
      if (propSchema.type === FieldType.object) {
        const propPath = [...fieldPath, propName];

        // Check if this property schema matches any parent schema in the path
        for (let i = 0; i < path.length; i++) {
          const parentPath = path.slice(0, i + 1);
          if (this.isSchemaSimilar(propSchema, this.getSchemaAtPath(rootSchema, parentPath))) {
            onPotentialCircular({ propName, propPath, parentPath });
          }
        }
      }
    }
  }

  private validateArrayItemCircularReferences(fieldSchema: FieldSchema, fieldPath: string[], onRecurse: (properties: unknown, newPath: string[]) => void): void {
    // Handle array items that might be objects - using proper typing
    const arraySchema = fieldSchema as { items?: FieldSchema | FieldSchema[] };

    if (arraySchema.items) {
      const items = Array.isArray(arraySchema.items) ? arraySchema.items[0] : arraySchema.items;

      if (items?.type === FieldType.object) {
        const itemSchema = items;
        if (itemSchema.properties) {
          onRecurse(itemSchema.properties, [...fieldPath, 'items']);
        }
      }
    }
  }

  /**
   * Helper method to check if two object schemas are similar (potentially circular)
   */
  private isSchemaSimilar(schema1: FieldSchema, schema2: ObjectFieldSchema | null): boolean {
    if (!schema2 || schema1.type !== FieldType.object) {
      return false;
    }

    const objectSchema1 = schema1;

    if (!objectSchema1.properties || !schema2.properties) {
      return false;
    }

    const keys1 = Object.keys(objectSchema1.properties).sort();
    const keys2 = Object.keys(schema2.properties).sort();

    // Simple heuristic: schemas are similar if they have the same property names
    return keys1.length === keys2.length && keys1.every((key, index) => key === keys2[index]);
  }

  /**
   * Helper method to get schema at a specific path
   */
  private getSchemaAtPath(rootSchema: Record<string, FieldSchema>, path: string[]): ObjectFieldSchema | null {
    let current: Record<string, FieldSchema> = rootSchema;

    for (const segment of path) {
      const fieldSchema = current[segment];
      if (fieldSchema?.type === FieldType.object) {
        const objectSchema = fieldSchema;
        if (objectSchema.properties) {
          current = objectSchema.properties as Record<string, FieldSchema>;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    const result: ObjectFieldSchema = {
      type: FieldType.object,
      properties: current,
    };
    return result;
  }

  public validateWithContext(schema: Record<string, FieldSchema>, validationContext: Partial<ValidationContext>): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const infos: ValidationIssue[] = [];
    const issues: ValidationIssue[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      const context: ValidationContext = {
        fieldPath: fieldName,
        depth: 0,
        ...validationContext,
      };

      const result = this.fieldHandlerRegistry.validateField(fieldSchema, context);
      const typedResult = result as ValidationResult & {
        errors?: ValidationIssue[];
        warnings?: ValidationIssue[];
        infos?: ValidationIssue[];
      };
      if (typedResult.errors) errors.push(...typedResult.errors);
      if (typedResult.warnings) warnings.push(...typedResult.warnings);
      if (typedResult.infos) infos.push(...typedResult.infos);
      if (result.issues) issues.push(...result.issues);
    }

    return ValidationResultCompatibilityUtil.createFromLegacy({
      isValid: errors.length === 0,
      issues: [...errors, ...warnings, ...infos],
    });
  }
}
