import { ValidationSeverity } from '../enums/validation.enums';
import type { ValidationResult } from '../interfaces/validation';
import type { ValidationIssue } from '../interfaces/validation/validation-issue.interface';
import { ValidationResultFactory } from '../interfaces/validation/validation-result.interface';

export class ValidationResultBuilder {
  private readonly issues: ValidationIssue[] = [];
  private readonly fieldPath: string;
  private metadata?: Record<string, unknown>;

  constructor(fieldPath?: string) {
    this.fieldPath = fieldPath ?? '';
  }

  addError(code: string, message: string, value?: unknown, constraint?: string, metadata?: Record<string, unknown>): this {
    const enhancedMessage = this.enhanceErrorMessage(message, this.fieldPath, value, constraint);
    this.issues.push({
      severity: ValidationSeverity.error,
      code,
      message: enhancedMessage,
      fieldPath: this.fieldPath,
      value,
      ...(constraint && { constraint }),
      ...(metadata && {
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          fieldType: typeof value,
          hasValue: value !== undefined && value !== null,
        },
      }),
    });
    return this;
  }

  addWarning(code: string, message: string, value?: unknown, metadata?: Record<string, unknown>): this {
    const enhancedMessage = this.enhanceErrorMessage(message, this.fieldPath, value);
    this.issues.push({
      severity: ValidationSeverity.warning,
      code,
      message: enhancedMessage,
      fieldPath: this.fieldPath,
      value,
      ...(metadata && {
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          fieldType: typeof value,
          hasValue: value !== undefined && value !== null,
        },
      }),
    });
    return this;
  }

  addInfo(code: string, message: string, metadata?: Record<string, unknown>): this {
    this.issues.push({
      severity: ValidationSeverity.info,
      code,
      message,
      fieldPath: this.fieldPath,
      ...(metadata && { metadata }),
    });
    return this;
  }

  addIssue(issue: ValidationIssue): this {
    this.issues.push(issue);
    return this;
  }

  addIssues(issues: ValidationIssue[]): this {
    this.issues.push(...issues);
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }

  build(): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    return ValidationResultFactory.create({
      isValid: this.issues.filter((issue) => issue.severity === ValidationSeverity.error).length === 0,
      issues: [...this.issues],
      fieldPath: this.fieldPath,
      ...(this.metadata && { metadata: this.metadata }),
    });
  }

  static success(fieldPath?: string, metadata?: Record<string, unknown>): ValidationResult {
    return new ValidationResultBuilder(fieldPath).setMetadata(metadata ?? {}).build();
  }

  static error(code: string, message: string, fieldPath: string, value?: unknown): ValidationResult {
    return new ValidationResultBuilder(fieldPath).addError(code, message, value).build();
  }

  private enhanceErrorMessage(message: string, fieldPath: string, value?: unknown, constraint?: string): string {
    const parts: string[] = [];

    // Add field path if available and not already in message
    if (fieldPath && !message.toLowerCase().includes('field') && !message.toLowerCase().includes(fieldPath.toLowerCase())) {
      parts.push(`Field '${fieldPath}'`);
    }

    // Add the original message
    parts.push(message);

    // Add value context if meaningful
    if (value !== undefined && value !== null) {
      const valueStr = this.formatValue(value);
      if (valueStr && !message.includes(valueStr)) {
        parts.push(`(received: ${valueStr})`);
      }
    }

    // Add constraint context
    if (constraint && !message.includes(constraint)) {
      parts.push(`(constraint: ${constraint})`);
    }

    return parts.join(' ');
  }

  private formatValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).length} properties}`;
    }
    return String(value);
  }
}
