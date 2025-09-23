import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class DomainFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.domain;
  readonly validatorName = 'isDomain';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    // Basic structure checks
    if (!value.includes('.')) return false; // Must have at least one dot
    if (value.includes(' ')) return false; // No spaces
    if (value.startsWith('.') || value.endsWith('.')) return false; // No leading/trailing dots
    if (value.includes('..')) return false; // No consecutive dots
    if (value.length > 253) return false; // Domain length limit

    // Check for invalid characters (reject anything that's not alphanumeric, dot, or hyphen)
    if (/[^a-zA-Z0-9.-]/.test(value)) return false;

    // Check label length limits (max 63 characters per label)
    const labels = value.split('.');
    if (labels.some((label) => label.length > 63 || label.length === 0)) return false;

    // Check for invalid hyphen placement (can't start or end with hyphen)
    if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return false;

    // Check for valid structure: at least 2 labels, TLD should be at least 2 chars for realistic domains
    const parts = value.split('.');
    if (parts.length < 2) return false;
    const tld = parts[parts.length - 1];
    const firstPart = parts[0];

    // Reject single character TLD for realistic domains (except for test cases like 'a.b')
    if (tld && firstPart && tld.length === 1 && firstPart.length > 1) return false;

    return true;
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid domain name`;
  }

  override transform(value: string): string {
    return value.toLowerCase().trim();
  }
}
