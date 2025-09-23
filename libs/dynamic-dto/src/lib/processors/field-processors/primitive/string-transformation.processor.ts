import { Injectable } from '@nestjs/common';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { StringTransformationUtils } from './utils/string-transformation.utils';

/**
 * StringTransformationProcessor handles data transformation responsibilities:
 * - Case transformations (lower, upper, camel, pascal, snake, kebab, etc.)
 * - Trimming operations (start, end, inner, custom characters)
 * - String normalization and cleaning
 *
 * Refactored to use shared utilities for better maintainability and reduced code duplication.
 */
@Injectable()
export class StringTransformationProcessor extends BaseFieldProcessor<StringFieldSchema> {
  readonly supportedType = FieldType.string;

  canProcess(schema: FieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string && (!!schema.caseTransform || !!schema.trimming);
  }

  generateValidationDecorators(_schema: StringFieldSchema, _isRequired: boolean, _parentIsArray: boolean): PropertyDecorator[] {
    // StringTransformationProcessor doesn't add validation decorators - it only transforms data
    return [];
  }

  getTypeSpecificTransformations(schema: StringFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // String processing transformation (order: 40)
    if (schema.trimming || schema.caseTransform) {
      functions.push({
        order: 40,
        name: 'string_processing',
        transform: ({ value }) => {
          if (typeof value !== 'string') return value;

          let result = value;

          // Apply trimming operations using shared utilities
          if (schema.trimming) {
            result = StringTransformationUtils.applyTrimming(result, schema.trimming);
          }

          // Apply case transformation using shared utilities
          if (schema.caseTransform) {
            result = StringTransformationUtils.applyCaseTransform(result, schema.caseTransform);
          }

          return result;
        },
        condition: (_, { value }) => typeof value === 'string',
      });
    }

    return functions;
  }
}
