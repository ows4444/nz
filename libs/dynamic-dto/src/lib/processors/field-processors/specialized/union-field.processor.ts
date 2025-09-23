import { Injectable } from '@nestjs/common';
import { FieldProcessor } from '../../../core/decorators/field-processor.decorator';
import { IsDefined, IsOptional } from 'class-validator';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { UnionFieldSchema } from '../../../core/interfaces/schema/specialized-primitives/union-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { UnionDiscriminatorHandlerService, UnionSafeDefaultService, UnionTransformerService, UnionTypeDetectorService, UnionValidatorRegistry, UnionValidatorService } from './services';

/**
 * Refactored Union Field Processor following Single Responsibility Principle.
 *
 * This processor now delegates to specialized services:
 * - UnionTypeDetectorService: Type detection and confidence calculation
 * - UnionValidatorService: Validation logic and decorators
 * - UnionDiscriminatorHandlerService: Discriminated union handling
 * - UnionTransformerService: Value transformations
 * - UnionSafeDefaultService: Safe default value generation (no code execution)
 * - UnionValidatorRegistry: Custom validator management
 *
 * Security vulnerability from expression evaluation has been removed.
 */
@FieldProcessor({ type: FieldType.union, priority: 1, category: 'specialized' })
@Injectable()
export class UnionFieldProcessor extends BaseFieldProcessor<UnionFieldSchema> {
  readonly supportedType = FieldType.union;

  constructor(
    private readonly typeDetector: UnionTypeDetectorService,
    private readonly validator: UnionValidatorService,
    private readonly discriminatorHandler: UnionDiscriminatorHandlerService,
    private readonly transformer: UnionTransformerService,
    private readonly safeDefaultService: UnionSafeDefaultService,
    private readonly validatorRegistry: UnionValidatorRegistry
  ) {
    super();
  }

  canProcess(schema: FieldSchema): schema is UnionFieldSchema {
    return schema.type === FieldType.union;
  }

  generateValidationDecorators(schema: UnionFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const eachOption = parentIsArray ? { each: true } : undefined;

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined(eachOption));
    } else {
      decorators.push(IsOptional(eachOption));
    }

    // Union validation based on strategy
    decorators.push(this.validator.createUnionValidator(schema, eachOption));

    // Discriminator validation if present
    if (schema.discriminator?.required) {
      decorators.push(this.validator.createDiscriminatorValidator(schema, eachOption));
    }

    return decorators;
  }

  getTypeSpecificTransformations(schema: UnionFieldSchema): TransformationFunction[] {
    return this.transformer.getTypeSpecificTransformations(schema);
  }

  /**
   * Validates schema structure to ensure it's properly configured
   * @param schema The schema to validate
   * @returns The validated schema
   */
  override validateSchemaStructure(schema: UnionFieldSchema) {
    const validatedSchema = super.validateSchemaStructure(schema);

    // Validate using the validator service
    const errors = this.validator.validateUnionSchema(schema);
    if (errors.length > 0) {
      throw new Error(`Union schema validation failed: ${errors.join(', ')}`);
    }

    return validatedSchema;
  }

  /**
   * Gets information about the services used by this processor (for debugging)
   * @returns Object containing service references
   */
  getProcessorServices() {
    return {
      typeDetector: this.typeDetector,
      validator: this.validator,
      discriminatorHandler: this.discriminatorHandler,
      transformer: this.transformer,
      safeDefaultService: this.safeDefaultService,
      validatorRegistry: this.validatorRegistry,
    };
  }
}
