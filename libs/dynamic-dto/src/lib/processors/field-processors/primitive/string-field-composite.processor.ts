import { Injectable } from '@nestjs/common';
import { FieldProcessor } from '../../../core/decorators/field-processor.decorator';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { StringBasicProcessor } from './string-basic.processor';
import { StringFormatProcessor } from './string-format.processor';
import { StringTransformationProcessor } from './string-transformation.processor';
import { StringAutoGenerationProcessor } from './string-auto-generation.processor';

/**
 * StringFieldProcessorComposite coordinates specialized string processors using composition pattern.
 * Refactored to use direct dependency injection instead of factory pattern to eliminate
 * circular dependency anti-patterns and improve clarity.
 *
 * Responsibilities:
 * - Delegates to specialized processors with clear separation of concerns
 * - Combines transformation functions with proper ordering
 * - Uses direct dependency injection for clear initialization
 * - Provides unified interface while preserving individual processor responsibilities
 */
@FieldProcessor({ type: FieldType.string, priority: 1, category: 'primitive' })
@Injectable()
export class StringFieldProcessorComposite extends BaseFieldProcessor<StringFieldSchema> {
  readonly supportedType = FieldType.string;

  constructor(
    private readonly basicProcessor: StringBasicProcessor,
    private readonly formatProcessor: StringFormatProcessor,
    private readonly transformationProcessor: StringTransformationProcessor,
    private readonly autoGenerationProcessor: StringAutoGenerationProcessor
  ) {
    super();
  }

  canProcess(schema: FieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string;
  }

  generateValidationDecorators(schema: StringFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Collect validation decorators from all processors via direct injection
    decorators.push(...this.basicProcessor.generateValidationDecorators(schema, isRequired, parentIsArray));
    decorators.push(...this.formatProcessor.generateValidationDecorators(schema, isRequired, parentIsArray));
    decorators.push(...this.transformationProcessor.generateValidationDecorators(schema, isRequired, parentIsArray));
    decorators.push(...this.autoGenerationProcessor.generateValidationDecorators(schema, isRequired, parentIsArray));

    return decorators;
  }

  getTypeSpecificTransformations(schema: StringFieldSchema): TransformationFunction[] {
    const allTransformations: TransformationFunction[] = [];

    // Collect transformations from all processors via direct injection
    allTransformations.push(...this.basicProcessor.getTypeSpecificTransformations(schema));
    allTransformations.push(...this.formatProcessor.getTypeSpecificTransformations(schema));
    allTransformations.push(...this.transformationProcessor.getTypeSpecificTransformations(schema));
    allTransformations.push(...this.autoGenerationProcessor.getTypeSpecificTransformations(schema));

    // Sort by order to ensure proper execution sequence:
    // 1. Auto-generation (order: 30) - generates values first
    // 2. String processing/transformation (order: 40) - processes the generated/input values
    // 3. Format normalization (order: 50) - normalizes based on format requirements
    return allTransformations.sort((a, b) => a.order - b.order);
  }

  /**
   * Validates that all constituent processors can handle the schema
   */
  override validateSchemaStructure(schema: StringFieldSchema) {
    // Validate basic schema structure first
    const validatedSchema = super.validateSchemaStructure(schema);

    // Ensure all processors that claim to handle this schema can actually process it
    const stringSchema = schema as StringFieldSchema;

    if (stringSchema.format && !this.formatProcessor.canProcess(schema)) {
      throw new Error(`Format processor cannot handle schema with format: ${stringSchema.format}`);
    }

    if ((stringSchema.caseTransform || stringSchema.trimming) && !this.transformationProcessor.canProcess(schema)) {
      throw new Error(`Transformation processor cannot handle schema with transformations`);
    }

    if (stringSchema.autoGenerate && !this.autoGenerationProcessor.canProcess(schema)) {
      throw new Error(`Auto-generation processor cannot handle schema with autoGenerate: ${stringSchema.autoGenerate}`);
    }

    return validatedSchema;
  }

  /**
   * Get all constituent processors for debugging/testing purposes
   */
  getProcessors() {
    return {
      basic: this.basicProcessor,
      format: this.formatProcessor,
      transformation: this.transformationProcessor,
      autoGeneration: this.autoGenerationProcessor,
    };
  }
}
