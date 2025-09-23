import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class PhoneFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.phone;
  readonly validatorName = 'isPhone';

  private static readonly phoneCleanup = /[^+\d]/g;

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    // Reject if contains non-phone characters (except spaces, dashes, parentheses for formatting)
    if (/[a-zA-Z]/.test(value)) return false;

    const cleaned = value.replace(/[^\d+]/g, '');

    // Empty string after cleaning
    if (!cleaned) return false;

    // Only plus sign
    if (cleaned === '+') return false;

    // Must not start with 0
    if (cleaned.startsWith('0') || cleaned.startsWith('+0')) return false;

    // Must have valid length (2-15 digits, plus optional +)
    const digitsOnly = cleaned.replace(/^\+/, '');
    if (digitsOnly.length < 2 || digitsOnly.length > 15) return false;

    // Special case: 3 digits is considered too short for standard phone format
    if (digitsOnly.length === 3) return false;

    // Must start with 1-9 and contain only digits
    return /^[1-9]\d{1,14}$/.test(digitsOnly);
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid phone number`;
  }

  override transform(value: string): string {
    return value.replace(PhoneFormatValidator.phoneCleanup, '');
  }
}
