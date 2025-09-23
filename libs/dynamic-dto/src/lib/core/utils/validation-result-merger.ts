import type { ValidationIssue, ValidationResult } from '../interfaces';
import { ValidationResultFactory } from '../interfaces/validation/validation-result.interface';

type SeverityType = 'error' | 'warning' | 'info';

interface ValidationResultWithSeverityGrouping extends ValidationResult {
  issuesBySeverity: Record<SeverityType, ValidationIssue[]>;
}

export class ValidationResultMerger {
  static mergeResults(results: ValidationResult[]): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    if (!results?.length) {
      return this.createEmptyResult();
    }

    if (results.length === 1) {
      const result = results[0];
      if (!result) {
        return this.createEmptyResult();
      }

      // Process single result to ensure consistent structure and cleaning
      const aggregatedData = this.aggregateResults([result]);
      const uniqueIssues = this.deduplicateIssues(aggregatedData.allIssues);
      return this.createMergedResult(uniqueIssues, aggregatedData);
    }

    const aggregatedData = this.aggregateResults(results);
    const uniqueIssues = this.deduplicateIssues(aggregatedData.allIssues);

    return this.createMergedResult(uniqueIssues, aggregatedData);
  }

  static mergeWithSeverityGrouping(results: ValidationResult[]): ValidationResultWithSeverityGrouping {
    const mergedResult = this.mergeResults(results);
    const issuesBySeverity = this.groupIssuesBySeverity(mergedResult.issues);

    return {
      ...mergedResult,
      issuesBySeverity,
    };
  }
  private static aggregateResults(results: ValidationResult[]) {
    const allIssues: ValidationIssue[] = [];
    const mergedMetadata: Record<string, unknown> = {};
    let isValid = true;

    for (const result of results) {
      if (!result) {
        continue;
      }

      this.collectIssuesFromResult(result, allIssues);

      if (result.metadata) {
        Object.assign(mergedMetadata, result.metadata);
      }

      if (!result.isValid) {
        isValid = false;
      }
    }

    return {
      allIssues,
      mergedMetadata,
      isValid,
      fieldPath: this.getMergedFieldPath(results),
    };
  }

  private static collectIssuesFromResult(result: ValidationResult, allIssues: ValidationIssue[]): void {
    if (!result) {
      return;
    }

    const typedResult = result as ValidationResult & {
      errors?: ValidationIssue[];
      warnings?: ValidationIssue[];
      infos?: ValidationIssue[];
    };
    const issueSources = [result.issues, typedResult.errors, typedResult.warnings, typedResult.infos];

    for (const issues of issueSources) {
      if (Array.isArray(issues) && issues.length) {
        allIssues.push(...issues);
      }
    }
  }

  private static deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
    const seen = new Set<string>();

    return issues.filter((issue) => {
      const key = this.createIssueKey(issue);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private static createIssueKey(issue: ValidationIssue): string {
    return `${issue.code}:${issue.fieldPath ?? 'root'}`;
  }

  private static groupIssuesBySeverity(issues: ValidationIssue[]): Record<SeverityType, ValidationIssue[]> {
    const grouped = issues.reduce((acc, issue) => {
      const severity = issue.severity as SeverityType;
      if (!acc[severity]) {
        acc[severity] = [];
      }
      acc[severity].push(this.cleanObject(issue));
      return acc;
    }, {} as Record<SeverityType, ValidationIssue[]>);

    return {
      error: grouped.error ?? [],
      warning: grouped.warning ?? [],
      info: grouped.info ?? [],
    };
  }

  private static getMergedFieldPath(results: ValidationResult[]): string | undefined {
    const fieldPaths = results
      .filter((result) => result !== null && result !== undefined)
      .map((result) => result.fieldPath)
      .filter((path): path is string => path !== undefined && path !== '');

    if (fieldPaths.length === 0) {
      return '';
    }

    if (fieldPaths.length === 1) {
      return fieldPaths[0];
    }

    return fieldPaths.join(', ');
  }

  private static createMergedResult(
    uniqueIssues: ValidationIssue[],
    aggregatedData: ReturnType<typeof ValidationResultMerger.aggregateResults>
  ): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    const { mergedMetadata, isValid, fieldPath } = aggregatedData;

    return ValidationResultFactory.create({
      isValid,
      issues: uniqueIssues.map((issue) => this.cleanObject(issue)),
      ...(Object.keys(mergedMetadata).length > 0 && {
        metadata: mergedMetadata,
      }),
      fieldPath: fieldPath ?? '',
    });
  }

  private static createEmptyResult(): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    return ValidationResultFactory.create({
      isValid: true,
      issues: [],
    });
  }

  private static cleanObject<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item: unknown) => this.cleanObject(item)) as T;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = typeof value === 'object' && value !== null ? this.cleanObject(value as Record<string, unknown>) : value;
      }
    }

    return cleaned as T;
  }
}
