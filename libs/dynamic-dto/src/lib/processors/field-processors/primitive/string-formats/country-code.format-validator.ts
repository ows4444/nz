import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class CountryCodeFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.country_code;
  readonly validatorName = 'isCountryCode';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^[A-Z]{2}$/.test(value);
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid ISO 3166-1 alpha-2 country code`;
  }

  override transform(value: string): string {
    return value.toUpperCase().trim();
  }
}
