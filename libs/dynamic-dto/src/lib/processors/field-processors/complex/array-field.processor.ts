import { Injectable } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDefined, IsOptional, ValidateNested } from 'class-validator';
import { BaseFieldProcessor } from '../../../core/abstractions/base-field-processor.abstract';
import { type TransformationFunction } from '../../../core/abstractions/transformation-processor.abstract';
import { FieldSchema } from '../../../core/interfaces/schema';
import { IFieldProcessingMediator } from '../../../core/interfaces/mediator/field-processing.mediator';
import { ArrayFieldSchema } from '../../../core/interfaces/schema/complex/array-field.schema';
import { FieldType } from '../../../core/types/field.types';

@Injectable()
export class ArrayFieldProcessor extends BaseFieldProcessor<ArrayFieldSchema> {
  readonly supportedType = FieldType.array;
  private processingMediator?: IFieldProcessingMediator;

  constructor() {
    super();
  }

  setProcessingMediator(mediator: IFieldProcessingMediator): void {
    this.processingMediator = mediator;
  }

  canProcess(schema: FieldSchema): schema is ArrayFieldSchema {
    return schema.type === FieldType.array;
  }

  generateValidationDecorators(schema: ArrayFieldSchema, isRequired: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined());
    } else {
      decorators.push(IsOptional());
    }

    // Array validation
    decorators.push(IsArray());

    // Size validation
    if (schema.minItems !== undefined) {
      decorators.push(ArrayMinSize(schema.minItems));
    }
    if (schema.maxItems !== undefined) {
      decorators.push(ArrayMaxSize(schema.maxItems));
    }

    // Item validation
    if (!Array.isArray(schema.items) && schema.items.type === FieldType.object) {
      decorators.push(ValidateNested({ each: true }));
    } else if (!Array.isArray(schema.items)) {
      if (!this.processingMediator) {
        throw new Error('ProcessingMediator not initialized in ArrayFieldProcessor');
      }
      const itemDecorators = this.processingMediator.processField(schema.items, true, true);
      decorators.push(...itemDecorators);
    }
    // If schema.items is an array, handle accordingly if needed
    else if (Array.isArray(schema.items)) {
      // This case is not handled in the original code, but we can add a check if needed
      // For now, we'll skip this complex case
    }

    return decorators;
  }

  getTypeSpecificTransformations(schema: ArrayFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Array coercion (order: 30)
    functions.push({
      order: 30,
      name: 'array_coercion',
      transform: ({ value }) => {
        if (Array.isArray(value)) return value;

        // Convert single values to arrays if not already an array
        if (value !== undefined && value !== null) {
          return [value];
        }

        return value;
      },
    });

    // Array processing (order: 40)
    functions.push({
      order: 40,
      name: 'array_processing',
      transform: ({ value }) => {
        if (!Array.isArray(value)) return value;

        let result = [...value];

        // Remove duplicates if configured
        if (schema.uniqueItems) {
          result = [...new Set(result)];
        }

        return result;
      },
      condition: (_, { value }) => Array.isArray(value),
    });

    // Basic item validation for complex items (order: 50)
    if (!Array.isArray(schema.items) && schema.items.type === FieldType.object) {
      functions.push({
        order: 50,
        name: 'item_validation',
        transform: ({ value }) => {
          if (!Array.isArray(value)) return value;

          // Basic validation that items are objects
          return value.filter((item) => item && typeof item === 'object');
        },
        condition: (_, { value }) => Array.isArray(value),
      });
    }

    return functions;
  }
}
