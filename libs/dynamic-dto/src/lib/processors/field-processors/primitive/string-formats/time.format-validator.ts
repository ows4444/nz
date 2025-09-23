import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class TimeFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.time;
  readonly validatorName = 'isTime';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    // 24-hour format: HH:MM or HH:MM:SS
    const is24Hour = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value);

    // 12-hour format with AM/PM: H:MM AM/PM or HH:MM:SS AM/PM (allows 01-12, space required)
    const is12Hour = /^(1[0-2]|0?[1-9]):[0-5][0-9](:[0-5][0-9])?\s(AM|PM|am|pm|Am|Pm|aM|pM)$/.test(value);

    return is24Hour || is12Hour;
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid time format (HH:MM, HH:MM:SS, or 12-hour with AM/PM)`;
  }

  override transform(value: string): string {
    if (typeof value !== 'string') return value;

    // Trim whitespace and normalize multiple spaces
    let normalized = value.trim().replace(/\s+/g, ' ');

    // Normalize AM/PM to uppercase
    normalized = normalized.replace(/\s+(am|pm|Am|Pm|aM|pM)\s*$/i, (match) => {
      return ` ${match.trim().toUpperCase()}`;
    });

    // Add leading zeros to single-digit hours (for 24-hour format)
    normalized = normalized.replace(/^(\d):/, '0$1:');

    // Handle empty strings
    if (normalized.trim() === '') return '';

    return normalized;
  }
}
