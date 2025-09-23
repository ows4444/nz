import { Injectable } from '@nestjs/common';
import { FieldProcessor } from '../../../core/decorators/field-processor.decorator';
import { IsDefined, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import type { FieldSchema } from '../../../core/interfaces/schema';
import type { ObjectFieldSchema } from '../../../core/interfaces/schema/complex/object-field.schema';
import { FieldType } from '../../../core/types/field.types';
import { CircularReferenceDetectorService } from './services/circular-reference-detector.service';
import { ObjectValidationService } from './services/object-validation.service';
import { PropertyFilteringService } from './services/property-filtering.service';
import { NestedObjectTransformerService } from './services/nested-object-transformer.service';

@FieldProcessor({ type: FieldType.object, priority: 2, category: 'complex' })
@Injectable()
export class ObjectFieldProcessorComposite extends BaseFieldProcessor<ObjectFieldSchema> {
  readonly supportedType = FieldType.object;
  private static readonly defaultMaxDepth = 10;

  constructor(
    private readonly circularReferenceDetector: CircularReferenceDetectorService,
    private readonly objectValidation: ObjectValidationService,
    private readonly propertyFiltering: PropertyFilteringService,
    private readonly nestedObjectTransformer: NestedObjectTransformerService
  ) {
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

    // 1. Circular reference detection (order: 10)
    functions.push({
      order: 10,
      name: 'circular_reference_check',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.circularReferenceDetector.detectAndHandleCircularReferences(value as Record<string, unknown>, ObjectFieldProcessorComposite.defaultMaxDepth);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // 2. Deep validation check (order: 20)
    functions.push({
      order: 20,
      name: 'deep_validation',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.objectValidation.performDeepValidation(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // 3. Nested class transformation preparation (order: 30)
    if (schema.properties) {
      this.nestedObjectTransformer.prepareNestedClassGeneration(schema);

      functions.push({
        order: 30,
        name: 'nested_class_validation',
        transform: ({ value }) => {
          if (!value || typeof value !== 'object') return value;
          return this.nestedObjectTransformer.validateNestedStructure(value as Record<string, unknown>, schema);
        },
        condition: (_, { value }) => Boolean(value && typeof value === 'object'),
      });
    }

    // 4. Property filtering based on permissions (order: 40)
    functions.push({
      order: 40,
      name: 'property_filtering',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.propertyFiltering.filterPropertiesByPermissions(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // 5. Additional properties handling (order: 50)
    if (schema.additionalProperties === false) {
      functions.push({
        order: 50,
        name: 'additional_properties_removal',
        transform: ({ value }) => {
          if (!value || typeof value !== 'object') return value;
          return this.propertyFiltering.removeAdditionalProperties(value as Record<string, unknown>, schema);
        },
        condition: (_, { value }) => Boolean(value && typeof value === 'object'),
      });
    }

    // 6. Property transformation (order: 60)
    functions.push({
      order: 60,
      name: 'property_transformation',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.propertyFiltering.transformObjectProperties(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    return functions;
  }

  public generateEnhancedTransformationDecorators(schema: ObjectFieldSchema): PropertyDecorator[] {
    const decorators = super.generateTransformationDecorators(schema);

    // Add Type decorator for nested class generation
    const nestedClassDecorator = this.nestedObjectTransformer.generateNestedClassDecorator(schema);
    if (nestedClassDecorator) {
      decorators.unshift(nestedClassDecorator);
    }

    return decorators;
  }
}
