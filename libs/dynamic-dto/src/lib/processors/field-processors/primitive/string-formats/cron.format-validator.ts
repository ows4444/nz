import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class CronFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.cron;
  readonly validatorName = 'isCron';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    const trimmedValue = value.trim();
    if (!trimmedValue) return false;

    const parts = trimmedValue.split(/\s+/);

    // Cron expression should have 5 parts (minute, hour, day, month, weekday)
    // Some systems support 6 parts (with seconds), but we'll validate 5-part format
    if (parts.length !== 5) return false;

    // Validate each part according to cron syntax
    const ranges = [
      { min: 0, max: 59, name: 'minute' }, // minutes
      { min: 0, max: 23, name: 'hour' }, // hours
      { min: 1, max: 31, name: 'day' }, // day of month
      { min: 1, max: 12, name: 'month' }, // month
      { min: 0, max: 7, name: 'weekday' }, // day of week (0 and 7 are Sunday)
    ];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const range = ranges[i];
      if (!part || !range || !this.validateCronPart(part, range)) {
        return false;
      }
    }

    return true;
  }

  private validateCronPart(part: string, range: { min: number; max: number; name: string }): boolean {
    // Allow wildcard
    if (part === '*') return true;

    // Allow question mark for day and weekday fields
    if (part === '?' && (range.name === 'day' || range.name === 'weekday')) return true;

    // Handle month and weekday names for the last two fields
    if (range.name === 'month') {
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      if (monthNames.includes(part.toUpperCase())) return true;
    }

    if (range.name === 'weekday') {
      const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      if (dayNames.includes(part.toUpperCase())) return true;
    }

    // Handle ranges (e.g., 1-5)
    if (part.includes('-')) {
      const rangeParts = part.split('-');
      if (rangeParts.length === 2 && rangeParts[0] && rangeParts[1]) {
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        return !isNaN(start) && !isNaN(end) && start >= range.min && start <= range.max && end >= range.min && end <= range.max && start <= end;
      }
      return false;
    }

    // Handle step values (e.g., */5, 2/10)
    if (part.includes('/')) {
      const stepParts = part.split('/');
      if (stepParts.length === 2 && stepParts[0] && stepParts[1]) {
        const step = parseInt(stepParts[1], 10);
        if (isNaN(step) || step <= 0) return false;

        if (stepParts[0] === '*') return true;

        const base = parseInt(stepParts[0], 10);
        return !isNaN(base) && base >= range.min && base <= range.max;
      }
      return false;
    }

    // Handle lists (e.g., 1,3,5)
    if (part.includes(',')) {
      const listParts = part.split(',');
      return listParts.every((p) => {
        const num = parseInt(p.trim(), 10);
        return !isNaN(num) && num >= range.min && num <= range.max;
      });
    }

    // Handle single numbers
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= range.min && num <= range.max;
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property ?? 'field';
    return `${property} must be a valid cron expression`;
  }
}
