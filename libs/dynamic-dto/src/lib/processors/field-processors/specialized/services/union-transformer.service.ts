import { Injectable } from '@nestjs/common';
import { FieldType } from '../../../../core/types/field.types';
import type { FieldSchema } from '../../../../core/interfaces/schema';
import type { TransformationFunction } from '../../../../core/abstractions/base-field-processor.abstract';
import { UnionFieldSchema } from '../../../../core/interfaces/schema/specialized-primitives/union-field.schema';
import { UnionTypeDetectorService } from './union-type-detector.service';
import { UnionDiscriminatorHandlerService } from './union-discriminator-handler.service';
import { UnionSafeDefaultService } from './union-safe-default.service';

/**
 * Service responsible for union type transformations.
 * Extracted from the main processor to improve maintainability and separation of concerns.
 */
@Injectable()
export class UnionTransformerService {
  constructor(
    private readonly typeDetector: UnionTypeDetectorService,
    private readonly discriminatorHandler: UnionDiscriminatorHandlerService,
    private readonly safeDefaultService: UnionSafeDefaultService
  ) {}

  /**
   * Gets all transformation functions for a union field
   * @param schema The union schema
   * @returns Array of transformation functions ordered by execution priority
   */
  getTypeSpecificTransformations(schema: UnionFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Add default value transformation
    if (schema.default !== undefined) {
      functions.push(this.createDefaultValueTransformation(schema));
    }

    // Add type resolution transformation
    functions.push(this.createTypeResolutionTransformation(schema));

    // Add type-specific transformation
    functions.push(this.createTypeSpecificTransformation(schema));

    // Sort by execution order
    return functions.sort((a, b) => a.order - b.order);
  }

  /**
   * Transforms a value for a specific union type
   * @param value The value to transform
   * @param typeSchema The target type schema
   * @returns The transformed value
   */
  transformValueForType(value: unknown, typeSchema: FieldSchema): unknown {
    switch (typeSchema.type) {
      case FieldType.string:
        return this.transformToString(value);
      case FieldType.number:
        return this.transformToNumber(value);
      case FieldType.boolean:
        return this.transformToBoolean(value);
      case FieldType.array:
        return this.transformToArray(value);
      case FieldType.object:
        return this.transformToObject(value);
      default:
        return value;
    }
  }

  /**
   * Creates default value transformation function
   * @param schema The union schema
   * @returns Transformation function for default values
   */
  private createDefaultValueTransformation(schema: UnionFieldSchema): TransformationFunction {
    return {
      order: 10,
      name: 'union_default',
      transform: ({ value }) => {
        if (value !== undefined) {
          return value;
        }
        return this.safeDefaultService.getDefaultValue(schema);
      },
      condition: (_, { value }) => value === undefined,
    };
  }

  /**
   * Creates type resolution transformation function
   * @param schema The union schema
   * @returns Transformation function for type resolution
   */
  private createTypeResolutionTransformation(schema: UnionFieldSchema): TransformationFunction {
    return {
      order: 20,
      name: 'union_type_resolution',
      transform: ({ value }) => {
        if (value === undefined || value === null) {
          return value;
        }

        // Handle discriminated unions
        if (this.discriminatorHandler.hasDiscriminator(schema)) {
          return this.discriminatorHandler.resolveDiscriminatedUnion(value, schema);
        }

        // For non-discriminated unions, just detect type for potential use
        // by downstream transformations (stored in metadata if needed)
        const detectedTypeIndex = this.typeDetector.detectUnionType(value, schema);

        // Store detected type index if detection was successful
        if (detectedTypeIndex >= 0 && typeof value === 'object' && value !== null) {
          return { ...value, _detectedUnionTypeIndex: detectedTypeIndex };
        }

        return value;
      },
      condition: () => true,
    };
  }

  /**
   * Creates type-specific transformation function
   * @param schema The union schema
   * @returns Transformation function for type-specific processing
   */
  private createTypeSpecificTransformation(schema: UnionFieldSchema): TransformationFunction {
    return {
      order: 30,
      name: 'union_type_transformation',
      transform: ({ value }) => {
        if (value === undefined || value === null) {
          return value;
        }

        // Detect the appropriate type for transformation
        let typeIndex = this.extractTypeIndex(value, schema);

        if (typeIndex < 0) {
          typeIndex = this.typeDetector.detectUnionType(value, schema);
        }

        // Apply transformation if type is detected
        if (typeIndex >= 0 && typeIndex < schema.unionTypes.length) {
          const targetTypeSchema = schema.unionTypes[typeIndex] as FieldSchema;
          return this.transformValueForType(value, targetTypeSchema);
        }

        return value;
      },
      condition: () => true,
    };
  }

  /**
   * Extracts type index from value metadata
   * @param value The value to check
   * @param schema The union schema
   * @returns Type index or -1 if not found
   */
  private extractTypeIndex(value: unknown, schema: UnionFieldSchema): number {
    if (typeof value !== 'object' || value === null) {
      return -1;
    }

    const valueObj = value as Record<string, unknown>;

    // Check for resolved discriminated union type index
    if (typeof valueObj._unionTypeIndex === 'number') {
      return valueObj._unionTypeIndex;
    }

    // Check for detected type index
    if (typeof valueObj._detectedUnionTypeIndex === 'number') {
      return valueObj._detectedUnionTypeIndex;
    }

    // Check discriminator if available
    if (this.discriminatorHandler.hasDiscriminator(schema)) {
      const discriminatorValue = this.discriminatorHandler.extractDiscriminatorValue(value, this.discriminatorHandler.getDiscriminatorProperty(schema)!);
      return this.discriminatorHandler.getTypeIndexForDiscriminator(discriminatorValue, schema);
    }

    return -1;
  }

  /**
   * Transforms value to string
   * @param value Input value
   * @returns String representation
   */
  private transformToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value as string;
  }

  /**
   * Transforms value to number
   * @param value Input value
   * @returns Numeric representation
   */
  private transformToNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return 0;
  }

  /**
   * Transforms value to boolean
   * @param value Input value
   * @returns Boolean representation
   */
  private transformToBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return ['true', '1', 'yes', 'on', 'enabled'].includes(lower);
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return Boolean(value);
  }

  /**
   * Transforms value to array
   * @param value Input value
   * @returns Array representation
   */
  private transformToArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (value === null || value === undefined) {
      return [];
    }
    // Wrap single values in array
    return [value];
  }

  /**
   * Transforms value to object
   * @param value Input value
   * @returns Object representation
   */
  private transformToObject(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown as Record<string, unknown>;
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }
}
