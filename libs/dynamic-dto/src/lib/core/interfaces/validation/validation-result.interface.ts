import type { DeepReadonly } from '../../types/common.types';
import type { ValidationIssue } from './validation-issue.interface';
import { ValidationSeverity } from '../../enums/validation.enums';

/**
 * Core validation result interface following DDD principles.
 *
 * This interface represents the outcome of validation operations with clear
 * separation between data and behavior, maintaining immutability and type safety.
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly fieldPath?: string;
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
  readonly summary: {
    readonly totalIssues: number;
    readonly errorCount: number;
    readonly warningCount: number;
    readonly infoCount: number;
  };
  readonly data?: unknown;
}

/**
 * Factory class for creating ValidationResult instances with proper convenience getters.
 *
 * This approach maintains interface purity while providing the convenience methods
 * that were previously defined as optional properties.
 */
export class ValidationResultFactory {
  /**
   * Creates a ValidationResult with computed convenience getters
   */
  static create(params: { isValid: boolean; issues: ValidationIssue[]; fieldPath?: string; metadata?: DeepReadonly<Record<string, unknown>>; data?: unknown }): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    const { isValid, issues, fieldPath, metadata, data } = params;

    // Compute summary statistics
    const summary = this.computeSummary(issues);

    // Create base result with proper undefined handling for exactOptionalPropertyTypes
    const baseResult: ValidationResult = {
      isValid,
      issues,
      summary,
      ...(fieldPath !== undefined && { fieldPath }),
      ...(metadata !== undefined && { metadata }),
      ...(data !== undefined && { data }),
    };

    // Add convenience getters
    return Object.defineProperties(baseResult, {
      errors: {
        get: () => issues.filter((issue) => issue.severity === ValidationSeverity.error),
        enumerable: true,
        configurable: false,
      },
      warnings: {
        get: () => issues.filter((issue) => issue.severity === ValidationSeverity.warning),
        enumerable: true,
        configurable: false,
      },
      infos: {
        get: () => issues.filter((issue) => issue.severity === ValidationSeverity.info),
        enumerable: true,
        configurable: false,
      },
    }) as ValidationResult & {
      readonly errors: ValidationIssue[];
      readonly warnings: ValidationIssue[];
      readonly infos: ValidationIssue[];
    };
  }

  /**
   * Computes summary statistics from validation issues
   */
  private static computeSummary(issues: ValidationIssue[]): {
    readonly totalIssues: number;
    readonly errorCount: number;
    readonly warningCount: number;
    readonly infoCount: number;
  } {
    const errorCount = issues.filter((issue) => issue.severity === ValidationSeverity.error).length;
    const warningCount = issues.filter((issue) => issue.severity === ValidationSeverity.warning).length;
    const infoCount = issues.filter((issue) => issue.severity === ValidationSeverity.info).length;

    return {
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount,
    };
  }
}
