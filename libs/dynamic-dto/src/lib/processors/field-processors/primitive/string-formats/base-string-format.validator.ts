import type { ValidationArguments, ValidationOptions } from 'class-validator';
import { registerDecorator } from 'class-validator';
import type { StringFormat } from '../../../../core/enums/string.enums';

export abstract class BaseStringFormatValidator {
  abstract readonly format: StringFormat;
  abstract readonly validatorName: string;

  abstract validate(value: unknown): boolean;
  abstract getDefaultMessage(args: ValidationArguments): string;

  createDecorator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: this.validatorName,
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate: this.validate.bind(this),
          defaultMessage: this.getDefaultMessage.bind(this),
        },
      });
    };
  }

  transform(value: string): string {
    return value;
  }
}
