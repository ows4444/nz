import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class CurrencyFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.currency;
  readonly validatorName = 'isCurrency';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^[A-Z]{3}$/.test(value);
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid ISO 4217 currency code`;
  }

  override transform(value: string): string {
    return value.toUpperCase().trim();
  }
}
