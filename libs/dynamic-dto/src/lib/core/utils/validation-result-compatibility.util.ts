import type { ValidationResult } from '../interfaces/validation/validation-result.interface';
import { ValidationResultFactory } from '../interfaces/validation/validation-result.interface';
import type { ValidationIssue } from '../interfaces/validation/validation-issue.interface';
import { ValidationSeverity } from '../enums/validation.enums';

/**
 * Utility class for maintaining backward compatibility during ValidationResult interface migration.
 *
 * This utility provides helper methods to safely create ValidationResult objects
 * from legacy patterns while ensuring type safety and proper interface compliance.
 *
 * @deprecated This utility is for migration purposes only. Use ValidationResultFactory.create() directly.
 */
export class ValidationResultCompatibilityUtil {
  /**
   * Creates a ValidationResult from legacy object patterns that directly assign errors/warnings/infos
   *
   * @param legacyResult - Object with legacy pattern properties
   * @returns Properly typed ValidationResult with convenience getters
   */
  static createFromLegacy(legacyResult: {
    isValid: boolean;
    issues?: ValidationIssue[];
    errors?: ValidationIssue[];
    warnings?: ValidationIssue[];
    infos?: ValidationIssue[];
    fieldPath?: string;
    metadata?: Record<string, unknown>;
    data?: unknown;
  }): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    // Merge all issues from different sources
    const allIssues: ValidationIssue[] = [];

    if (legacyResult.issues) {
      allIssues.push(...legacyResult.issues);
    }

    if (legacyResult.errors) {
      allIssues.push(...legacyResult.errors);
    }

    if (legacyResult.warnings) {
      allIssues.push(...legacyResult.warnings);
    }

    if (legacyResult.infos) {
      allIssues.push(...legacyResult.infos);
    }

    return ValidationResultFactory.create({
      isValid: legacyResult.isValid,
      issues: allIssues,
      ...(legacyResult.fieldPath && { fieldPath: legacyResult.fieldPath }),
      ...(legacyResult.metadata && { metadata: legacyResult.metadata }),
      ...(legacyResult.data !== undefined && { data: legacyResult.data }),
    });
  }

  /**
   * Creates a simple failure result with error issues
   */
  static createFailure(
    errorMessage: string,
    code = 'VALIDATION_ERROR',
    fieldPath?: string,
    metadata?: Record<string, unknown>
  ): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    return ValidationResultFactory.create({
      isValid: false,
      issues: [
        {
          severity: ValidationSeverity.error,
          message: errorMessage,
          code,
          fieldPath: fieldPath ?? '',
          ...(metadata && { metadata }),
        },
      ],
      ...(fieldPath && { fieldPath }),
      ...(metadata && { metadata }),
    });
  }

  /**
   * Creates a simple success result
   */
  static createSuccess(data?: unknown): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    return ValidationResultFactory.create({
      isValid: true,
      issues: [],
      data,
    });
  }

  /**
   * Merges multiple validation results into one
   */
  static mergeResults(results: ValidationResult[]): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    const allIssues: ValidationIssue[] = [];

    for (const result of results) {
      allIssues.push(...result.issues);
    }

    return ValidationResultFactory.create({
      isValid: allIssues.filter((issue) => issue.severity === ValidationSeverity.error).length === 0,
      issues: allIssues,
    });
  }
}
