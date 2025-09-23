import { Injectable } from '@nestjs/common';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { StringValidationUtils } from './utils/string-validation.utils';

/**
 * StringBasicProcessor handles core string validation responsibilities:
 * - Type validation (string)
 * - Required/optional validation
 * - Length constraints (min, max, exact)
 * - Pattern matching (regex)
 * - Anti-pattern validation
 *
 * Refactored to use shared utilities and composition pattern for better maintainability.
 */
@Injectable()
export class StringBasicProcessor extends BaseFieldProcessor<StringFieldSchema> {
  readonly supportedType = FieldType.string;

  canProcess(schema: FieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string;
  }

  generateValidationDecorators(schema: StringFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    // Use shared utilities for common validation
    const decorators = StringValidationUtils.generateCommonValidationDecorators(isRequired, parentIsArray, schema.nullable);

    const eachOption = parentIsArray ? { each: true } : undefined;

    // Add length validation using shared utilities
    const lengthOptions: {
      minLength?: number;
      maxLength?: number;
      exactLength?: number;
    } = {};
    if (schema.minLength !== undefined) lengthOptions.minLength = schema.minLength;
    if (schema.maxLength !== undefined) lengthOptions.maxLength = schema.maxLength;
    if (schema.exactLength !== undefined) lengthOptions.exactLength = schema.exactLength;

    StringValidationUtils.addLengthValidation(decorators, lengthOptions, eachOption);

    // Add pattern validation using shared utilities
    const patternOptions: {
      pattern?: string | RegExp;
      antiPattern?: string | RegExp;
    } = {};
    if (schema.pattern !== undefined) patternOptions.pattern = schema.pattern;
    if (schema.antiPattern !== undefined) patternOptions.antiPattern = schema.antiPattern;

    StringValidationUtils.addPatternValidation(decorators, patternOptions, eachOption);

    return decorators;
  }

  getTypeSpecificTransformations(_schema: StringFieldSchema): TransformationFunction[] {
    // StringBasicProcessor doesn't handle transformations - that's StringTransformationProcessor's responsibility
    return [];
  }
}
