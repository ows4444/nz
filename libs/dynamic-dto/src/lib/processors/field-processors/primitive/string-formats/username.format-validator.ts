import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class UsernameFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.username;
  readonly validatorName = 'isUsername';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^[a-zA-Z0-9_-]{3,30}$/.test(value);
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid username (3-30 characters, alphanumeric, underscore, hyphen)`;
  }

  override transform(value: string): string {
    return value.toLowerCase().trim();
  }
}
