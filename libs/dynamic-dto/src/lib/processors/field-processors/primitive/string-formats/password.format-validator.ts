import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class PasswordFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.password;
  readonly validatorName = 'isStrongPassword';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a strong password (min 8 chars, 1 upper, 1 lower, 1 number, 1 special character)`;
  }
}
