import { Injectable } from '@nestjs/common';
import { FieldProcessor } from '../../../core/decorators/field-processor.decorator';
import { IsDefined, IsInt, IsNegative, IsNumber, IsOptional, IsPositive, Max, Min, registerDecorator, ValidationArguments } from 'class-validator';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { FieldType } from '../../../core/types/field.types';
import type { NumberFieldSchema } from '../../../core/interfaces/schema/primitive/number-field.schema';

@FieldProcessor({ type: FieldType.number, priority: 1, category: 'primitive' })
@Injectable()
export class NumberFieldProcessor extends BaseFieldProcessor<NumberFieldSchema> {
  readonly supportedType = FieldType.number;

  canProcess(schema: FieldSchema): schema is NumberFieldSchema {
    return schema.type === FieldType.number;
  }

  generateValidationDecorators(schema: NumberFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    if (isRequired) {
      decorators.push(IsDefined(parentIsArray ? { each: true } : undefined));
    } else {
      decorators.push(IsOptional(parentIsArray ? { each: true } : undefined));
    }

    decorators.push(IsNumber({}, parentIsArray ? { each: true } : undefined));

    if (schema.min !== undefined) {
      decorators.push(Min(schema.min, parentIsArray ? { each: true } : undefined));
    }
    if (schema.max !== undefined) {
      decorators.push(Max(schema.max, parentIsArray ? { each: true } : undefined));
    }

    // Integer validation
    if (schema.integer === true) {
      decorators.push(IsInt(parentIsArray ? { each: true } : undefined));
    }

    // Positive/Negative validation
    if (schema.positive === true) {
      decorators.push(IsPositive(parentIsArray ? { each: true } : undefined));
    }

    if (schema.negative === true) {
      decorators.push(IsNegative(parentIsArray ? { each: true } : undefined));
    }

    // Exclusive min/max validation
    if (schema.exclusiveMin !== undefined) {
      decorators.push(this.createExclusiveMinValidator(schema.exclusiveMin, parentIsArray));
    }

    if (schema.exclusiveMax !== undefined) {
      decorators.push(this.createExclusiveMaxValidator(schema.exclusiveMax, parentIsArray));
    }

    // Multiple of validation
    if (schema.multipleOf !== undefined) {
      decorators.push(this.createMultipleOfValidator(schema.multipleOf, parentIsArray));
    }

    // Decimal validation (if not integer)
    if (schema.integer === false && schema.scale !== undefined) {
      decorators.push(this.createDecimalValidator(schema.scale, parentIsArray));
    }

    return decorators;
  }

  getTypeSpecificTransformations(schema: NumberFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Type coercion transformation (order: 30)
    functions.push({
      order: 30,
      name: 'type_coercion',
      transform: ({ value }) => {
        if (value === null || value === undefined) return value;

        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed === '') return value;

          const num = Number(trimmed);
          return isNaN(num) ? value : num;
        }

        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }

        return value;
      },
    });

    // Precision and rounding (order: 40)
    if (schema.precision !== undefined || schema.scale !== undefined) {
      functions.push({
        order: 40,
        name: 'precision_rounding',
        transform: ({ value }) => {
          if (typeof value !== 'number') return value;

          if (schema.scale !== undefined) {
            return Math.round(value * Math.pow(10, schema.scale)) / Math.pow(10, schema.scale);
          }

          if (schema.precision !== undefined) {
            return Number(value.toPrecision(schema.precision));
          }

          return value;
        },
        condition: (_, { value }) => typeof value === 'number',
      });
    }

    // Range clamping (order: 50)
    if (schema.clamp && (schema.min !== undefined || schema.max !== undefined)) {
      functions.push({
        order: 50,
        name: 'range_clamping',
        transform: ({ value }) => {
          if (typeof value !== 'number') return value;

          let result = value;
          if (schema.min !== undefined && result < schema.min) {
            result = schema.min;
          }
          if (schema.max !== undefined && result > schema.max) {
            result = schema.max;
          }

          return result;
        },
        condition: (_, { value }) => typeof value === 'number',
      });
    }

    return functions;
  }

  /**
   * Creates validator for exclusive minimum constraint
   */
  private createExclusiveMinValidator(exclusiveMin: number, parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isExclusiveMin',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { ...options },
        constraints: [exclusiveMin],
        validator: {
          validate(value: unknown, args: ValidationArguments): boolean {
            if (typeof value !== 'number') return false;
            const [min] = args.constraints as [number];
            return value > min;
          },
          defaultMessage(args: ValidationArguments): string {
            const [min] = args.constraints as [number];
            return `${args.property} must be greater than ${min}`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for exclusive maximum constraint
   */
  private createExclusiveMaxValidator(exclusiveMax: number, parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isExclusiveMax',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { ...options },
        constraints: [exclusiveMax],
        validator: {
          validate(value: unknown, args: ValidationArguments): boolean {
            if (typeof value !== 'number') return false;
            const [max] = args.constraints as [number];
            return value < max;
          },
          defaultMessage(args: ValidationArguments): string {
            const [max] = args.constraints as [number];
            return `${args.property} must be less than ${max}`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for multipleOf constraint
   */
  private createMultipleOfValidator(multipleOf: number, parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isMultipleOf',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { ...options },
        constraints: [multipleOf],
        validator: {
          validate(value: unknown, args: ValidationArguments): boolean {
            if (typeof value !== 'number') return false;
            const [divisor] = args.constraints as [number];
            return Number.isInteger(value / divisor);
          },
          defaultMessage(args: ValidationArguments): string {
            const [divisor] = args.constraints as [number];
            return `${args.property} must be a multiple of ${divisor}`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for decimal places constraint
   */
  private createDecimalValidator(maxDecimalPlaces: number, parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isDecimal',
        target: target.constructor,
        propertyName: String(propertyName),
        options: { ...options },
        constraints: [maxDecimalPlaces],
        validator: {
          validate(value: unknown, args: ValidationArguments): boolean {
            if (typeof value !== 'number') return false;
            const [maxPlaces] = args.constraints as [number];
            const decimalPlaces = (value.toString().split('.')[1] ?? '').length;
            return decimalPlaces <= maxPlaces;
          },
          defaultMessage(args: ValidationArguments): string {
            const [maxPlaces] = args.constraints as [number];
            return `${args.property} must have at most ${maxPlaces} decimal places`;
          },
        },
      });
    };
  }
}
