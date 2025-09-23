import type { FieldSchema } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import type { ValidatedFieldSchema } from '../interfaces/schema';
import type { FieldValidationService } from '../services/field-validation.service';
import type { FieldTransformationService, TransformationFunction } from '../services/field-transformation.service';
import type { FieldSerializationService } from '../services/field-serialization.service';

/**
 * Simplified BaseFieldProcessor with separated concerns
 *
 * This replaces the complex 318-line BaseFieldProcessor with a focused
 * orchestrator that delegates to specialized services.
 */
export abstract class SimplifiedBaseFieldProcessor<T extends FieldSchema = FieldSchema> {
  abstract readonly supportedType: FieldTypeValue;
  abstract canProcess(schema: FieldSchema): schema is T;
  abstract getTypeSpecificTransformations(schema: T): TransformationFunction[];

  constructor(
    protected readonly validationService: FieldValidationService,
    protected readonly transformationService: FieldTransformationService,
    protected readonly serializationService: FieldSerializationService
  ) {}

  /**
   * Type-safe schema validation
   */
  validateSchemaStructure(schema: T): ValidatedFieldSchema<T> {
    if (!schema.type || typeof schema.type !== 'string') {
      throw new Error(`Invalid schema: missing or invalid type property`);
    }

    if (schema.type !== this.supportedType) {
      throw new Error(`Schema type mismatch: expected ${this.supportedType}, got ${schema.type}`);
    }

    return schema as ValidatedFieldSchema<T>;
  }

  /**
   * Generate validation decorators using the validation service
   */
  generateValidationDecorators(schema: T, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    const validatedSchema = this.validateSchemaStructure(schema);
    return this.validationService.generateValidationDecorators(validatedSchema, isRequired, parentIsArray);
  }

  /**
   * Generate transformation decorators using the transformation service
   */
  generateTransformationDecorators(schema: T): PropertyDecorator[] {
    const validatedSchema = this.validateSchemaStructure(schema);
    return this.transformationService.generateTransformationDecorators(validatedSchema);
  }

  /**
   * Generate serialization decorators using the serialization service
   */
  generateSerializationDecorators(schema: T, isRequired: boolean, isArray: boolean): PropertyDecorator[] {
    const validatedSchema = this.validateSchemaStructure(schema);
    return this.serializationService.generateSerializationDecorators(validatedSchema, isRequired, isArray);
  }

  /**
   * Get all transformation functions (both generic and type-specific)
   */
  getAllTransformationFunctions(schema: T): TransformationFunction[] {
    const genericTransformations = this.transformationService.collectTransformationFunctions(schema);
    const typeSpecificTransformations = this.getTypeSpecificTransformations(schema);

    return [...genericTransformations, ...typeSpecificTransformations].sort((a, b) => a.order - b.order);
  }

  /**
   * Utility method for nested value access (kept from original for compatibility)
   */
  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((val: unknown, key) => (val as Record<string, unknown>)?.[key], obj);
  }

  /**
   * Generate validation message (kept from original for compatibility)
   */
  protected getValidationMessage(schema: T, type: string): string {
    return `Field ${schema.type} validation failed for ${type}`;
  }
}
