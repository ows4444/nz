import { ValidationSeverity } from '../../core/enums/validation.enums';
import type { SerializedValidationError, ValidationErrorContext } from './base-validation.error';
import { BaseValidationError } from './base-validation.error';
import type { ValidationIssue, ValidationResult } from '../../core/interfaces/validation';

export interface ValidationErrorSummary {
  readonly totalErrors: number;
  readonly criticalErrors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly fieldErrors: Record<string, BaseValidationError[]>;
  readonly schemaErrors: BaseValidationError[];
  readonly hasBlockingErrors: boolean;
  readonly errorsByCode: Record<string, BaseValidationError[]>;
  readonly errorsByField: Record<string, BaseValidationError[]>;
  readonly mostCommonErrors: { code: string; count: number; message: string }[];
  readonly affectedFieldPaths: string[];
  readonly errorContext: {
    timestamp: string;
    totalValidationAttempts: number;
    failureRate: number;
  };
}

export class ValidationErrorAggregator {
  private readonly errors: BaseValidationError[] = [];
  private readonly context: ValidationErrorContext;

  constructor(context?: ValidationErrorContext) {
    this.context = context || { fieldPath: '' };
  }

  /**
   * Add a single validation error
   */
  addError(error: BaseValidationError): this {
    this.errors.push(error);
    return this;
  }

  /**
   * Add multiple validation errors
   */
  addErrors(errors: BaseValidationError[]): this {
    this.errors.push(...errors);
    return this;
  }

  /**
   * Convert ValidationResult to errors and add them
   */
  addFromValidationResult(result: ValidationResult): this {
    if (result.issues) {
      // Enhanced context with validation result metadata
      const enhancedContext = {
        ...this.context,
        ...(result.fieldPath && { fieldPath: result.fieldPath }),
        ...(result.metadata && { metadata: result.metadata }),
        ...(result.summary && {
          validationSummary: {
            totalIssues: result.summary.totalIssues,
            errorCount: result.summary.errorCount,
            warningCount: result.summary.warningCount,
            infoCount: result.summary.infoCount,
          },
        }),
        timestamp: new Date(),
      };

      const errors = BaseValidationError.fromValidationIssues(result.issues, enhancedContext);
      this.addErrors(errors);
    }
    return this;
  }

  /**
   * Convert ValidationIssues to errors and add them
   */
  addFromValidationIssues(issues: ValidationIssue[]): this {
    const errors = BaseValidationError.fromValidationIssues(issues, this.context);
    this.addErrors(errors);
    return this;
  }

  /**
   * Check if aggregator has any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if aggregator has critical errors
   */
  hasCriticalErrors(): boolean {
    return this.errors.some((error) => error.isCritical());
  }

  /**
   * Get all errors
   */
  getErrors(): readonly BaseValidationError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ValidationSeverity): BaseValidationError[] {
    return this.errors.filter((error) => error.severity === severity);
  }

  /**
   * Get errors by field path
   */
  getErrorsByField(fieldPath: string): BaseValidationError[] {
    return this.errors.filter((error) => error.context?.fieldPath === fieldPath);
  }

  /**
   * Get errors by error code
   */
  getErrorsByCode(code: string): BaseValidationError[] {
    return this.errors.filter((error) => error.code === code);
  }

  /**
   * Get detailed error summary
   */
  getSummary(): ValidationErrorSummary {
    const fieldErrors: Record<string, BaseValidationError[]> = {};
    const errorsByField: Record<string, BaseValidationError[]> = {};
    const schemaErrors: BaseValidationError[] = [];
    const errorsByCode: Record<string, BaseValidationError[]> = {};
    const errorCounts: Record<string, { count: number; message: string }> = {};
    const affectedFieldPaths = new Set<string>();

    // Group errors by field and code, collect statistics
    for (const error of this.errors) {
      // Group by field
      if (error.context?.fieldPath) {
        const fieldPath = error.context.fieldPath;
        if (!fieldErrors[fieldPath]) {
          fieldErrors[fieldPath] = [];
        }
        if (!errorsByField[fieldPath]) {
          errorsByField[fieldPath] = [];
        }
        fieldErrors[fieldPath].push(error);
        errorsByField[fieldPath].push(error);
        affectedFieldPaths.add(fieldPath);
      } else {
        schemaErrors.push(error);
      }

      // Group by code
      if (!errorsByCode[error.code]) {
        errorsByCode[error.code] = [];
      }
      errorsByCode[error.code]!.push(error);

      // Count error occurrences
      if (!errorCounts[error.code]) {
        errorCounts[error.code] = { count: 0, message: error.message };
      }
      errorCounts[error.code]!.count++;
    }

    // Generate most common errors
    const mostCommonErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([code, { count, message }]) => ({ code, count, message }));

    const totalValidationAttempts = this.errors.length > 0 ? this.errors.length : 1;
    const criticalErrorCount = this.getErrorsBySeverity(ValidationSeverity.error).length;
    const failureRate = (criticalErrorCount / totalValidationAttempts) * 100;

    return {
      totalErrors: this.errors.length,
      criticalErrors: criticalErrorCount,
      warnings: this.getErrorsBySeverity(ValidationSeverity.warning).length,
      infos: this.getErrorsBySeverity(ValidationSeverity.info).length,
      fieldErrors,
      errorsByField,
      schemaErrors,
      hasBlockingErrors: this.hasCriticalErrors(),
      errorsByCode,
      mostCommonErrors,
      affectedFieldPaths: Array.from(affectedFieldPaths),
      errorContext: {
        timestamp: new Date().toISOString(),
        totalValidationAttempts,
        failureRate: Math.round(failureRate * 100) / 100,
      },
    };
  }

  /**
   * Serialize all errors for API response
   */
  serializeErrors(): SerializedValidationError[] {
    return this.errors.map((error) => error.serialize());
  }

  /**
   * Get user-friendly error messages
   */
  getUserMessages(): string[] {
    return this.errors.map((error) => error.getUserMessage());
  }

  /**
   * Get comprehensive error report
   */
  getErrorReport(): string {
    const summary = this.getSummary();
    let report = `🚨 Validation Summary (${summary.errorContext.timestamp}):\n`;
    report += `- Total Errors: ${summary.totalErrors}\n`;
    report += `- Critical: ${summary.criticalErrors}\n`;
    report += `- Warnings: ${summary.warnings}\n`;
    report += `- Info: ${summary.infos}\n`;
    report += `- Failure Rate: ${summary.errorContext.failureRate}%\n`;
    report += `- Blocking: ${summary.hasBlockingErrors ? 'Yes' : 'No'}\n`;
    report += `- Affected Fields: ${summary.affectedFieldPaths.length}\n\n`;

    // Most common errors section
    if (summary.mostCommonErrors.length > 0) {
      report += `🔥 Most Common Errors:\n`;
      summary.mostCommonErrors.forEach((error, index) => {
        report += `${index + 1}. ${error.code} (${error.count}x): ${error.message}\n`;
      });
      report += `\n`;
    }

    // Field-specific errors
    if (summary.affectedFieldPaths.length > 0) {
      report += `📍 Errors by Field:\n`;
      summary.affectedFieldPaths.forEach((fieldPath) => {
        const fieldErrors = summary.errorsByField[fieldPath] || [];
        const criticalCount = fieldErrors.filter((e) => e.severity === ValidationSeverity.error).length;
        const warningCount = fieldErrors.filter((e) => e.severity === ValidationSeverity.warning).length;
        report += `- ${fieldPath}: ${criticalCount} errors, ${warningCount} warnings\n`;
      });
      report += `\n`;
    }

    // Critical errors detail
    if (summary.criticalErrors > 0) {
      report += `❌ Critical Errors:\n`;
      this.getErrorsBySeverity(ValidationSeverity.error).forEach((error, index) => {
        report += `${index + 1}. ${error.getErrorWithSuggestions()}\n\n`;
      });
    }

    // Warnings detail
    if (summary.warnings > 0) {
      report += `⚠️ Warnings:\n`;
      this.getErrorsBySeverity(ValidationSeverity.warning).forEach((error, index) => {
        report += `${index + 1}. ${error.getErrorWithSuggestions()}\n\n`;
      });
    }

    return report;
  }

  /**
   * Clear all errors
   */
  clear(): this {
    this.errors.length = 0;
    return this;
  }

  /**
   * Filter errors by predicate
   */
  filter(predicate: (error: BaseValidationError) => boolean): BaseValidationError[] {
    return this.errors.filter(predicate);
  }

  /**
   * Group errors by a key function
   */
  groupBy<K extends string | number>(keyFn: (error: BaseValidationError) => K): Record<K, BaseValidationError[]> {
    return this.errors.reduce((groups: Record<K, BaseValidationError[]>, error) => {
      const key = keyFn(error);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(error);
      return groups;
    }, {} as Record<K, BaseValidationError[]>);
  }

  /**
   * Create a new aggregator with only critical errors
   */
  getCriticalErrorsAggregator(): ValidationErrorAggregator {
    const aggregator = new ValidationErrorAggregator(this.context);
    aggregator.addErrors(this.getErrorsBySeverity(ValidationSeverity.error));
    return aggregator;
  }

  /**
   * Check if specific error code exists
   */
  hasErrorCode(code: string): boolean {
    return this.errors.some((error) => error.code === code);
  }

  /**
   * Get unique error codes
   */
  getErrorCodes(): string[] {
    return [...new Set(this.errors.map((error) => error.code))];
  }

  /**
   * Convert to ValidationResult format
   */
  toValidationResult(): ValidationResult {
    const issues: ValidationIssue[] = this.errors.map((error) => ({
      message: error.message,
      code: error.code,
      severity: error.severity,
      fieldPath: error.context?.fieldPath || '',
      metadata: error.metadata,
    }));

    return {
      isValid: !this.hasCriticalErrors(),
      issues,
      errors: this.getErrorsBySeverity(ValidationSeverity.error).map((e) => ({
        message: e.message,
        code: e.code,
        severity: e.severity,
        fieldPath: e.context?.fieldPath || '',
        metadata: e.metadata,
      })),
      warnings: this.getErrorsBySeverity(ValidationSeverity.warning).map((e) => ({
        message: e.message,
        code: e.code,
        severity: e.severity,
        fieldPath: e.context?.fieldPath || '',
        metadata: e.metadata,
      })),
      infos: this.getErrorsBySeverity(ValidationSeverity.info).map((e) => ({
        message: e.message,
        code: e.code,
        severity: e.severity,
        fieldPath: e.context?.fieldPath || '',
        metadata: e.metadata,
      })),
    };
  }
}
