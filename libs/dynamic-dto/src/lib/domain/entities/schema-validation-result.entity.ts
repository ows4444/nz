import type { ValidationResult } from '../../core/interfaces/validation';
import type { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';

export class SchemaValidationResultEntity {
  constructor(
    public readonly schemaId: string,
    public readonly validationResult: ValidationResult,
    public readonly validatedAt: Date,
    public readonly validatorType: string,
    public readonly userId?: string
  ) {}

  get isValid(): boolean {
    return this.validationResult.isValid;
  }

  get hasWarnings(): boolean {
    const typedResult = this.validationResult as ValidationResult & {
      warnings?: ValidationIssue[];
    };
    return (typedResult.warnings?.length ?? 0) > 0;
  }

  get errorCount(): number {
    const typedResult = this.validationResult as ValidationResult & {
      errors?: ValidationIssue[];
    };
    return typedResult.errors?.length ?? 0;
  }

  get warningCount(): number {
    const typedResult = this.validationResult as ValidationResult & {
      warnings?: ValidationIssue[];
    };
    return typedResult.warnings?.length ?? 0;
  }

  toJSON() {
    const typedResult = this.validationResult as ValidationResult & {
      errors?: ValidationIssue[];
      warnings?: ValidationIssue[];
    };
    return {
      schemaId: this.schemaId,
      isValid: this.isValid,
      errors: typedResult.errors,
      warnings: typedResult.warnings,
      errorCount: this.errorCount,
      warningCount: this.warningCount,
      validatedAt: this.validatedAt,
      validatorType: this.validatorType,
      userId: this.userId,
    };
  }
}
