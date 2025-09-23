import { Injectable, Logger } from '@nestjs/common';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import {
  ValidationErrorContext as IValidationErrorContext,
  ValidationError,
  ValidationErrorAggregated,
  ValidationErrorSeverity,
  ValidationIssue,
  ValidationResult,
} from '../../core/interfaces/validation';
import { FieldTypeValue } from '../../core/types/field.types';
import { BaseValidationError, ValidationErrorContext } from './base-validation.error';
import { ValidationErrorAggregator } from './validation-error-aggregator';
import {
  FieldConstraintValidationError,
  FieldDeprecationValidationError,
  FieldPermissionValidationError,
  FieldRequiredValidationError,
  FieldSecurityValidationError,
  FieldTypeValidationError,
} from './field-validation.error';
import { SchemaBusinessRuleError, SchemaCircularReferenceError, SchemaCrossFieldValidationError, SchemaFieldNamingError, SchemaStructureValidationError } from './schema-validation.error';

export interface ValidationErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<ValidationSeverity, number>;
  averageErrorsPerField: number;
  mostCommonErrors: { code: string; count: number }[];
  errorTrends: { timestamp: Date; errorCount: number }[];
}

@Injectable()
export class ValidationErrorService {
  private readonly logger = new Logger(ValidationErrorService.name);
  private readonly errorMetrics: ValidationErrorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsBySeverity: {
      [ValidationSeverity.error]: 0,
      [ValidationSeverity.warning]: 0,
      [ValidationSeverity.info]: 0,
      [ValidationSeverity.debug]: 0,
    },
    averageErrorsPerField: 0,
    mostCommonErrors: [],
    errorTrends: [],
  };

  /**
   * Create simple field validation error (for test compatibility)
   */
  createFieldError(field: string, value: unknown, message: string, code: string, context?: IValidationErrorContext): ValidationError {
    return {
      field,
      value,
      message,
      code,
      context,
    };
  }

  /**
   * Create optimized field validation errors
   */
  createLegacyFieldError(
    errorType: 'TYPE_MISMATCH' | 'REQUIRED' | 'CONSTRAINT' | 'PERMISSION' | 'DEPRECATED' | 'SECURITY',
    fieldName: string,
    details: Record<string, any>,
    context?: ValidationErrorContext
  ): BaseValidationError {
    switch (errorType) {
      case 'TYPE_MISMATCH':
        return new FieldTypeValidationError(fieldName, details.expectedType, details.actualType, context);
      case 'REQUIRED':
        return new FieldRequiredValidationError(fieldName, context);
      case 'CONSTRAINT':
        return new FieldConstraintValidationError(fieldName, details.constraintType, details.constraintValue, details.actualValue, context);
      case 'PERMISSION':
        return new FieldPermissionValidationError(fieldName, details.requiredPermissions, details.userRoles, details.operation, context);
      case 'DEPRECATED':
        return new FieldDeprecationValidationError(fieldName, details, context);
      case 'SECURITY':
        return new FieldSecurityValidationError(fieldName, details.securityIssue, context);
      default:
        throw new Error(`Unknown field error type: ${String(errorType)}`);
    }
  }

  /**
   * Create constraint validation error
   */
  createConstraintError(field: string, value: unknown, constraint: string, expectedValue: unknown, message: string, context?: IValidationErrorContext): ValidationError {
    const enhancedContext: IValidationErrorContext = {
      fieldPath: context?.fieldPath ?? field,
      ...context,
      constraint,
      expectedValue,
      actualValue: value,
    };

    return {
      field,
      value,
      message,
      code: 'CONSTRAINT_VIOLATION',
      context: enhancedContext,
    };
  }

  /**
   * Create type mismatch validation error
   */
  createTypeError(field: string, value: unknown, expectedType: FieldTypeValue, actualType: string, context?: IValidationErrorContext): ValidationError {
    const enhancedContext: IValidationErrorContext = {
      fieldPath: context?.fieldPath ?? field,
      ...context,
      expectedType,
      actualType,
    };

    const message = `Expected field '${field}' to be of type '${expectedType}', but received '${actualType}'`;

    return {
      field,
      value,
      message,
      code: 'TYPE_MISMATCH',
      context: enhancedContext,
    };
  }

  /**
   * Format error message for validation errors
   */
  formatErrorMessage(field: string, constraint: string, expectedValue: unknown, actualValue: unknown): string {
    if (!constraint || constraint.trim() === '') {
      return `Field '${field}' validation failed. Expected: ${String(expectedValue)}, Actual: ${String(actualValue)}`;
    }

    switch (constraint.toLowerCase()) {
      case 'required':
        return `Field '${field}' is required`;
      case 'min':
        return `Field '${field}' must be at least ${expectedValue as string} (received: ${actualValue as string})`;
      case 'max':
        return `Field '${field}' must not exceed ${expectedValue as string} (received: ${actualValue as string})`;
      case 'minlength':
        return `Field '${field}' must be at least ${expectedValue as string} characters long (received: ${String(actualValue).length} characters)`;
      case 'maxlength':
        return `Field '${field}' must not exceed ${expectedValue as string} characters (received: ${String(actualValue).length} characters)`;
      default:
        return `Field '${field}' failed ${constraint} validation. Expected: ${String(expectedValue)}, Actual: ${String(actualValue)}`;
    }
  }

  /**
   * Aggregate multiple validation errors
   */
  aggregateErrors(errors: ValidationError[]): ValidationErrorAggregated {
    const errorsByField: Record<string, ValidationError[]> = {};
    const errorsByCode: Record<string, ValidationError[]> = {};

    for (const error of errors) {
      // Group by field
      errorsByField[error.field] ??= [];
      errorsByField[error.field].push(error);

      // Group by code
      errorsByCode[error.code] ??= [];
      errorsByCode[error.code].push(error);
    }

    return {
      totalErrors: errors.length,
      errorsByField,
      errorsByCode,
    };
  }

  /**
   * Get error severity based on error code
   */
  getErrorSeverity(error: ValidationError): ValidationErrorSeverity {
    switch (error.code.toUpperCase()) {
      case 'REQUIRED_FIELD':
      case 'TYPE_MISMATCH':
      case 'FIELD_PERMISSION_DENIED':
        return 'critical';
      case 'CONSTRAINT_VIOLATION':
      case 'INVALID_VALUE':
        return 'error';
      case 'INVALID_FORMAT':
      case 'MIN_LENGTH':
      case 'MAX_LENGTH':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Create structural validation error
   */
  createStructuralError(message: string, code: string, context?: IValidationErrorContext): ValidationError {
    return {
      field: '',
      value: undefined,
      message,
      code,
      context,
    };
  }

  /**
   * Create optimized schema validation errors
   */
  createSchemaError(
    errorType: 'STRUCTURE' | 'CIRCULAR_REFERENCE' | 'FIELD_NAMING' | 'BUSINESS_RULE' | 'CROSS_FIELD',
    schemaName: string,
    details: Record<string, any>,
    context?: ValidationErrorContext
  ): BaseValidationError {
    switch (errorType) {
      case 'STRUCTURE':
        return new SchemaStructureValidationError(schemaName, details.structureIssue, context);
      case 'CIRCULAR_REFERENCE':
        return new SchemaCircularReferenceError(schemaName, details.circularPath, context);
      case 'FIELD_NAMING':
        return new SchemaFieldNamingError(schemaName, details.namingIssue, details.affectedFields, context);
      case 'BUSINESS_RULE':
        return new SchemaBusinessRuleError(schemaName, details.ruleViolation, details.description, context);
      case 'CROSS_FIELD':
        return new SchemaCrossFieldValidationError(schemaName, details.conflictType, details.fields, details.description, context);
      default:
        throw new Error(`Unknown schema error type: ${String(errorType)}`);
    }
  }

  /**
   * Create aggregator from ValidationResult
   */
  createAggregatorFromResult(result: ValidationResult, context?: ValidationErrorContext): ValidationErrorAggregator {
    const aggregator = new ValidationErrorAggregator(context);
    aggregator.addFromValidationResult(result);
    this.updateMetrics(aggregator);
    return aggregator;
  }

  /**
   * Create aggregator from ValidationIssues
   */
  createAggregatorFromIssues(issues: ValidationIssue[], context?: ValidationErrorContext): ValidationErrorAggregator {
    const aggregator = new ValidationErrorAggregator(context);
    aggregator.addFromValidationIssues(issues);
    this.updateMetrics(aggregator);
    return aggregator;
  }

  /**
   * Optimize error collection for performance
   */
  optimizeErrors(errors: BaseValidationError[]): BaseValidationError[] {
    // Remove duplicate errors
    const uniqueErrors = this.deduplicateErrors(errors);

    // Prioritize critical errors
    const prioritized = this.prioritizeErrors(uniqueErrors);

    // Limit total errors for performance
    const limited = this.limitErrors(prioritized);

    this.logger.debug(`Optimized ${errors.length} errors to ${limited.length} unique, prioritized errors`);

    return limited;
  }

  /**
   * Remove duplicate errors based on code and field path
   */
  private deduplicateErrors(errors: BaseValidationError[]): BaseValidationError[] {
    const seen = new Set<string>();
    return errors.filter((error) => {
      const key = `${error.code}:${error.context?.fieldPath ?? 'schema'}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Sort errors by severity and importance
   */
  private prioritizeErrors(errors: BaseValidationError[]): BaseValidationError[] {
    return errors.sort((a, b) => {
      // First by severity (ERROR > WARNING > INFO)
      const severityOrder = {
        [ValidationSeverity.error]: 3,
        [ValidationSeverity.warning]: 2,
        [ValidationSeverity.info]: 1,
      };

      const severityDiff = (severityOrder[b.severity as keyof typeof severityOrder] || 0) - (severityOrder[a.severity as keyof typeof severityOrder] || 0);
      if (severityDiff !== 0) return severityDiff;

      // Then by error code priority
      const criticalCodes = ['FIELD_REQUIRED', 'FIELD_TYPE_MISMATCH', 'FIELD_PERMISSION_DENIED'];
      const aIsCritical = criticalCodes.includes(a.code);
      const bIsCritical = criticalCodes.includes(b.code);

      if (aIsCritical && !bIsCritical) return -1;
      if (!aIsCritical && bIsCritical) return 1;

      // Finally by alphabetical order for consistency
      return a.code.localeCompare(b.code);
    });
  }

  /**
   * Limit errors to prevent performance issues
   */
  private limitErrors(errors: BaseValidationError[], maxErrors = 50): BaseValidationError[] {
    if (errors.length <= maxErrors) {
      return errors;
    }

    // Keep all critical errors and limit others
    const criticalErrors = errors.filter((error) => error.isCritical());
    const nonCriticalErrors = errors.filter((error) => !error.isCritical());

    const remainingSlots = maxErrors - criticalErrors.length;
    const limitedNonCritical = nonCriticalErrors.slice(0, Math.max(0, remainingSlots));

    this.logger.warn(`Limited errors from ${errors.length} to ${maxErrors} (${criticalErrors.length} critical, ${limitedNonCritical.length} non-critical)`);

    return [...criticalErrors, ...limitedNonCritical];
  }

  /**
   * Update error metrics for monitoring
   */
  private updateMetrics(aggregator: ValidationErrorAggregator): void {
    const errors = aggregator.getErrors();

    // Update totals
    this.errorMetrics.totalErrors += errors.length;

    // Update by type
    for (const error of errors) {
      this.errorMetrics.errorsByType[error.constructor.name] = (this.errorMetrics.errorsByType[error.constructor.name] ?? 0) + 1;
    }

    // Update by severity
    for (const error of errors) {
      this.errorMetrics.errorsBySeverity[error.severity]++;
    }

    // Update trends (simplified)
    this.errorMetrics.errorTrends.push({
      timestamp: new Date(),
      errorCount: errors.length,
    });

    // Keep only last 100 trend points
    if (this.errorMetrics.errorTrends.length > 100) {
      this.errorMetrics.errorTrends = this.errorMetrics.errorTrends.slice(-100);
    }
  }

  /**
   * Get error metrics for monitoring
   */
  getMetrics(): ValidationErrorMetrics {
    // Calculate most common errors
    const errorCounts = Object.entries(this.errorMetrics.errorsByType)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      ...this.errorMetrics,
      mostCommonErrors: errorCounts,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.errorMetrics.totalErrors = 0;
    this.errorMetrics.errorsByType = {};
    this.errorMetrics.errorsBySeverity = {
      [ValidationSeverity.error]: 0,
      [ValidationSeverity.warning]: 0,
      [ValidationSeverity.info]: 0,
      [ValidationSeverity.debug]: 0,
    };
    this.errorMetrics.averageErrorsPerField = 0;
    this.errorMetrics.mostCommonErrors = [];
    this.errorMetrics.errorTrends = [];
  }

  /**
   * Create context-aware error aggregator
   */
  createContextAggregator(schemaName?: string, userRoles?: readonly string[], operation?: 'create' | 'read' | 'update' | 'delete', requestId?: string): ValidationErrorAggregator {
    const context: ValidationErrorContext = {
      fieldPath: '',
      ...(schemaName && { schemaName }),
      ...(userRoles && { userRoles }),
      ...(operation && { operation }),
      ...(requestId && { requestId }),
      timestamp: new Date(),
    };

    return new ValidationErrorAggregator(context);
  }

  /**
   * Log error summary for debugging
   */
  logErrorSummary(aggregator: ValidationErrorAggregator): void {
    const summary = aggregator.getSummary();

    if (summary.hasBlockingErrors) {
      this.logger.error(`Validation failed: ${summary.criticalErrors} critical errors, ${summary.warnings} warnings`);
    } else if (summary.warnings > 0) {
      this.logger.warn(`Validation passed with warnings: ${summary.warnings} warnings`);
    } else {
      this.logger.debug('Validation passed successfully');
    }

    // Log top error codes for debugging
    const topErrors = Object.entries(summary.errorsByCode)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([code, errors]) => `${code}(${errors.length})`)
      .join(', ');

    if (topErrors) {
      this.logger.debug(`Top error codes: ${topErrors}`);
    }
  }
}
