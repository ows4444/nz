import { Injectable } from '@nestjs/common';
import { IsDefined, IsIn, IsNotEmpty, IsOptional, registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { BaseFieldProcessor } from '../../../core/abstractions/base-field-processor.abstract';
import { type TransformationFunction } from '../../../core/abstractions/transformation-processor.abstract';
import { EnumFieldSchema, EnumSortOrder, EnumTransform } from '../../../core/interfaces/schema/specialized-primitives/enum-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';

/**
 * Interface for computed default configuration
 */
interface ComputedDefaultConfig {
  type: 'computed';
  expression?: string;
  strategy?: 'first' | 'last' | 'middle' | 'most_common' | 'random_weighted';
  weights?: Record<string | number, number>;
  condition?: (values: (string | number)[]) => boolean;
}

@Injectable()
export class EnumFieldProcessor extends BaseFieldProcessor<EnumFieldSchema> {
  readonly supportedType = FieldType.enum;

  canProcess(schema: FieldSchema): schema is EnumFieldSchema {
    return schema.type === FieldType.enum;
  }

  generateValidationDecorators(schema: EnumFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const eachOption = parentIsArray ? { each: true } : undefined;

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined(eachOption));

      if (!schema.nullable) {
        decorators.push(IsNotEmpty(eachOption));
      }
    } else {
      decorators.push(IsOptional(eachOption));
    }

    // Enum validation
    if (schema.allowMultiple) {
      // For multiple selection, validate each value is in enum
      decorators.push(this.createMultipleEnumValidator(schema, eachOption));
    } else {
      // Standard enum validation
      if (schema.caseSensitive === false) {
        decorators.push(this.createCaseInsensitiveEnumValidator(schema, eachOption));
      } else {
        decorators.push(IsIn([...schema.values], eachOption));
      }
    }

    // Deprecated value warnings
    if (schema.deprecatedValues && schema.deprecatedValues.length > 0) {
      decorators.push(this.createDeprecatedValueValidator(schema, eachOption));
    }

    return decorators;
  }

  getTypeSpecificTransformations(schema: EnumFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Default value assignment (order: 10)
    if (schema.default !== undefined) {
      functions.push({
        order: 10,
        name: 'enum_default',
        transform: ({ value }) => {
          if (value !== undefined) return value;

          if (typeof schema.default === 'object' && schema.default !== null) {
            const defaultConfig = schema.default;
            switch (defaultConfig.type) {
              case 'first':
                return schema.values[0]!;
              case 'random':
                return schema.values[Math.floor(Math.random() * schema.values.length)];
              case 'computed':
                return this.computeDefaultValue(schema, defaultConfig);
              default:
                return schema.default;
            }
          }

          return schema.default;
        },
        condition: (_, { value }) => value === undefined,
      });
    }

    // Case transformation for case-insensitive enums (order: 20)
    if (schema.caseSensitive === false) {
      functions.push({
        order: 20,
        name: 'enum_case_normalize',
        transform: ({ value }) => {
          if (typeof value !== 'string') return value;

          // Find matching enum value (case-insensitive)
          const matchingValue = schema.values.find((enumValue) => typeof enumValue === 'string' && enumValue.toLowerCase() === value.toLowerCase());

          return matchingValue ?? value;
        },
        condition: (_, { value }) => typeof value === 'string',
      });
    }

    // Enum transformation (order: 30)
    if (schema.transform && schema.transform !== EnumTransform.none) {
      functions.push({
        order: 30,
        name: 'enum_transform',
        transform: ({ value }) => {
          if (value === undefined || value === null) return value;

          switch (schema.transform) {
            case EnumTransform.uppercase:
              return typeof value === 'string' ? value.toUpperCase() : value;
            case EnumTransform.lowercase:
              return typeof value === 'string' ? value.toLowerCase() : value;
            case EnumTransform.capitalize:
              return typeof value === 'string' ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
            case EnumTransform.label:
              return schema.labels?.[value as string | number] ?? value;
            default:
              return value;
          }
        },
        condition: () => true,
      });
    }

    // Multiple value processing (order: 40)
    if (schema.allowMultiple) {
      functions.push({
        order: 40,
        name: 'enum_multiple_processing',
        transform: ({ value }) => {
          if (!Array.isArray(value)) {
            // Convert single value to array
            return value !== undefined ? [value] : [];
          }

          // Remove duplicates and sort if specified
          const uniqueValues = [...new Set(value)];

          if (schema.sort && schema.sort !== EnumSortOrder.none) {
            return this.sortEnumValues(uniqueValues, schema);
          }

          return uniqueValues;
        },
        condition: () => true,
      });
    }

    return functions;
  }

  private createMultipleEnumValidator(schema: EnumFieldSchema, validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isMultipleEnum',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { ...validationOptions },
        validator: {
          validate(value: any) {
            if (!Array.isArray(value)) {
              // Single values are allowed and will be converted to array
              return schema.values.includes(value);
            }

            // All values must be valid enum values
            return value.every((val) => schema.values.includes(val));
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must contain only valid enum values: ${schema.values.join(', ')}`;
          },
        },
      });
    };
  }

  private createCaseInsensitiveEnumValidator(schema: EnumFieldSchema, validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isCaseInsensitiveEnum',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { ...validationOptions },
        validator: {
          validate(value: any) {
            if (typeof value !== 'string') {
              return schema.values.includes(value);
            }

            return schema.values.some((enumValue) => typeof enumValue === 'string' && enumValue.toLowerCase() === value.toLowerCase());
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be one of: ${schema.values.join(', ')} (case-insensitive)`;
          },
        },
      });
    };
  }

  private createDeprecatedValueValidator(schema: EnumFieldSchema, validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isNotDeprecatedEnum',
        target: target.constructor,
        propertyName: String(propertyName),
        options: {
          ...validationOptions,
          // Make this a warning rather than an error
          message: `${String(propertyName)} uses deprecated value. Deprecated values: ${schema.deprecatedValues?.join(', ')}`,
        },
        validator: {
          validate(value: any) {
            // Always return true but log warning
            if (schema.deprecatedValues?.includes(value)) {
              console.warn(`Deprecated enum value used: ${value} for field ${String(propertyName)}`);
            }
            return true;
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} uses a deprecated value`;
          },
        },
      });
    };
  }

  private sortEnumValues(values: (string | number)[], schema: EnumFieldSchema): (string | number)[] {
    switch (schema.sort) {
      case EnumSortOrder.asc:
        return [...values].sort();
      case EnumSortOrder.desc:
        return [...values].sort().reverse();
      case EnumSortOrder.alphabetical:
        return [...values].sort((a, b) => String(a).localeCompare(String(b)));
      case EnumSortOrder.definition:
        // Sort by order of appearance in schema.values
        return [...values].sort((a, b) => {
          const indexA = schema.values.indexOf(a);
          const indexB = schema.values.indexOf(b);
          return indexA - indexB;
        });
      case EnumSortOrder.frequency:
        return this.sortByFrequency(values, schema);
      default:
        return values;
    }
  }

  /**
   * Computes a default value based on configuration
   */
  private computeDefaultValue(schema: EnumFieldSchema, config: any): string | number {
    const computedConfig = config as ComputedDefaultConfig;

    switch (computedConfig.strategy) {
      case 'first':
        return schema.values[0]!;

      case 'last':
        return schema.values[schema.values.length - 1]!;

      case 'middle':
        const middleIndex = Math.floor(schema.values.length / 2);
        return schema.values[middleIndex]!;

      case 'most_common':
        // In absence of usage statistics, return first value
        // In production, this would query usage statistics
        return schema.values[0]!;

      case 'random_weighted':
        return this.selectWeightedRandom([...schema.values], computedConfig.weights || {});

      default:
        // Evaluate expression if provided (simplified implementation)
        if (computedConfig.expression) {
          return this.evaluateExpression(computedConfig.expression, schema);
        }
        return schema.values[0]!;
    }
  }

  /**
   * Selects a random value based on weights
   */
  private selectWeightedRandom(values: (string | number)[], weights: Record<string | number, number>): string | number {
    const totalWeight = values.reduce((sum, value) => {
      const weight = typeof weights[value] === 'number' ? weights[value] : 1;
      return (sum as number) + weight;
    }, 0);
    let random = Math.random() * (totalWeight as number);

    for (const value of values) {
      const weight = typeof weights[value] === 'number' ? weights[value] : 1;
      random -= weight;
      if (random <= 0) {
        return value;
      }
    }

    return values[0]!; // Fallback - values array is guaranteed to have at least one element
  }

  /**
   * Evaluates simple expressions for computed defaults
   */
  private evaluateExpression(expression: string, schema: EnumFieldSchema): string | number {
    // Simplified expression evaluation
    // In production, use a safe expression evaluator
    const context = {
      values: schema.values,
      count: schema.values.length,
      first: schema.values[0],
      last: schema.values[schema.values.length - 1],
    };

    // Handle simple cases
    if (expression === 'first' && context.first !== undefined) return context.first;
    if (expression === 'last' && context.last !== undefined) return context.last;
    if (expression === 'random') return context.values[Math.floor(Math.random() * context.count)]!;

    // Default fallback
    return context.first!; // Schema validation ensures values array is not empty
  }

  /**
   * Sorts enum values by frequency of use
   */
  private sortByFrequency(values: (string | number)[], schema: EnumFieldSchema): (string | number)[] {
    // In absence of real usage statistics, implement a heuristic approach
    // Priority: labels exist > position in original array > alphabetical

    const frequencyMap = new Map<string | number, number>();

    // Assign base frequency based on position (earlier = more frequent)
    values.forEach((value, index) => {
      const baseFrequency = schema.values.length - index;
      frequencyMap.set(value, baseFrequency);
    });

    // Boost frequency for values with labels (assuming labeled values are more important)
    if (schema.labels) {
      values.forEach((value) => {
        if (schema.labels![value]) {
          const currentFreq = frequencyMap.get(value) || 0;
          frequencyMap.set(value, currentFreq + 10); // Boost labeled values
        }
      });
    }

    // Sort by frequency (descending)
    return [...values].sort((a, b) => {
      const freqA = frequencyMap.get(a) || 0;
      const freqB = frequencyMap.get(b) || 0;
      return freqB - freqA;
    });
  }
}
