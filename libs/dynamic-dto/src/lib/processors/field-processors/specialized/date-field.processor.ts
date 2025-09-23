import { Injectable } from '@nestjs/common';
import { FieldProcessor } from '../../../core/decorators/field-processor.decorator';
import { IsDate, IsDateString, IsDefined, IsOptional, registerDecorator, ValidationArguments } from 'class-validator';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../../core/interfaces/schema';
import { DateFieldSchema, DateFormat } from '../../../core/interfaces/schema/specialized-primitives/date-field.schema';
import { FieldType } from '../../../core/types/field.types';

@FieldProcessor({ type: FieldType.date, priority: 1, category: 'specialized' })
@Injectable()
export class DateFieldProcessor extends BaseFieldProcessor<DateFieldSchema> {
  readonly supportedType = FieldType.date;

  canProcess(schema: FieldSchema): schema is DateFieldSchema {
    return schema.type === FieldType.date;
  }

  generateValidationDecorators(schema: DateFieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const options = parentIsArray ? { each: true } : undefined;

    if (isRequired) {
      decorators.push(IsDefined(options));
    } else {
      decorators.push(IsOptional(options));
    }

    // Date validation based on format
    switch (schema.format) {
      case DateFormat.iso:
        decorators.push(IsDateString({}, options));
        break;
      default:
        decorators.push(IsDate(options));
    }

    // Min/Max date validation
    if (schema.min !== undefined) {
      decorators.push(this.createMinDateValidator(schema.min, parentIsArray));
    }

    if (schema.max !== undefined) {
      decorators.push(this.createMaxDateValidator(schema.max, parentIsArray));
    }

    // Future/Past validation
    if (schema.validateFuture === true) {
      decorators.push(this.createFutureDateValidator(parentIsArray));
    }

    if (schema.validatePast === true) {
      decorators.push(this.createPastDateValidator(parentIsArray));
    }

    // Business days validation
    if (schema.validateBusinessDays === true) {
      decorators.push(this.createBusinessDayValidator(parentIsArray));
    }

    return decorators;
  }

  getTypeSpecificTransformations(schema: DateFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Date parsing transformation (order: 30)
    functions.push({
      order: 30,
      name: 'date_parsing',
      transform: ({ value }) => {
        if (!value) return value;
        if (value instanceof Date) return value;

        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return value;

          // Try parsing as ISO string first
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) {
            return date;
          }

          // Try parsing with specific format if provided
          if (schema.format === DateFormat.iso) {
            const isoDate = new Date(trimmed);
            return !isNaN(isoDate.getTime()) ? isoDate : value;
          }

          return value;
        }

        if (typeof value === 'number') {
          // Assume timestamp
          const date = new Date(value);
          return !isNaN(date.getTime()) ? date : value;
        }

        return value;
      },
    });

    // Date formatting transformation (order: 40)
    if (schema.format) {
      functions.push({
        order: 40,
        name: 'date_formatting',
        transform: ({ value }) => {
          if (!(value instanceof Date)) return value;

          switch (schema.format) {
            case DateFormat.iso:
              return value.toISOString();
            default:
              return value;
          }
        },
        condition: (_, { value }) => value instanceof Date,
      });
    }

    return functions;
  }

  /**
   * Creates validator for minimum date constraint
   */
  private createMinDateValidator(minDate: Date | string, parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;
    const min = typeof minDate === 'string' ? new Date(minDate) : minDate;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isMinDate',
        target: target.constructor,
        propertyName: String(propertyName),
        ...(options && { options }),
        constraints: [min],
        validator: {
          validate(value: unknown, args: ValidationArguments): boolean {
            if (!(value instanceof Date)) return false;
            const [minDate] = args.constraints;
            return value >= minDate;
          },
          defaultMessage(args: ValidationArguments): string {
            const [minDate] = args.constraints;
            return `${args.property} must not be earlier than ${minDate.toISOString()}`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for maximum date constraint
   */
  private createMaxDateValidator(maxDate: Date | string, parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;
    const max = typeof maxDate === 'string' ? new Date(maxDate) : maxDate;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isMaxDate',
        target: target.constructor,
        propertyName: String(propertyName),
        ...(options && { options }),
        constraints: [max],
        validator: {
          validate(value: unknown, args: ValidationArguments): boolean {
            if (!(value instanceof Date)) return false;
            const [maxDate] = args.constraints;
            return value <= maxDate;
          },
          defaultMessage(args: ValidationArguments): string {
            const [maxDate] = args.constraints;
            return `${args.property} must not be later than ${maxDate.toISOString()}`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for future dates
   */
  private createFutureDateValidator(parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isFutureDate',
        target: target.constructor,
        propertyName: String(propertyName),
        ...(options && { options }),
        validator: {
          validate(value: unknown): boolean {
            if (!(value instanceof Date)) return false;
            return value > new Date();
          },
          defaultMessage(args: ValidationArguments): string {
            return `${args.property} must be a future date`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for past dates
   */
  private createPastDateValidator(parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isPastDate',
        target: target.constructor,
        propertyName: String(propertyName),
        ...(options && { options }),
        validator: {
          validate(value: unknown): boolean {
            if (!(value instanceof Date)) return false;
            return value < new Date();
          },
          defaultMessage(args: ValidationArguments): string {
            return `${args.property} must be a past date`;
          },
        },
      });
    };
  }

  /**
   * Creates validator for business days (Monday-Friday)
   */
  private createBusinessDayValidator(parentIsArray?: boolean): PropertyDecorator {
    const options = parentIsArray ? { each: true } : undefined;

    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isBusinessDay',
        target: target.constructor,
        propertyName: String(propertyName),
        ...(options && { options }),
        validator: {
          validate(value: unknown): boolean {
            if (!(value instanceof Date)) return false;
            const dayOfWeek = value.getDay();
            return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday = 1, Friday = 5
          },
          defaultMessage(args: ValidationArguments): string {
            return `${args.property} must be a business day (Monday-Friday)`;
          },
        },
      });
    };
  }
}
