import { ValidationSeverity } from '../../core/enums/validation.enums';
import type { ValidationErrorContext, ValidationErrorSuggestion } from './base-validation.error';
import { BaseValidationError } from './base-validation.error';

export interface SchemaProcessingErrorDetails {
  readonly schemaId: string;
  readonly errorType: 'VALIDATION_FAILED' | 'PROCESSING_FAILED' | 'FIELD_RESOLUTION_FAILED';
  readonly errors?: readonly unknown[];
  readonly failedFields?: readonly string[];
  readonly processingStage?: 'schema_parsing' | 'field_processing' | 'validation' | 'dto_generation' | undefined;
}

/**
 * Specialized error for schema processing and validation failures
 * Provides structured error information with context and recovery suggestions
 */
export class SchemaValidationError extends BaseValidationError {
  public readonly details: SchemaProcessingErrorDetails;

  constructor(details: SchemaProcessingErrorDetails, context?: ValidationErrorContext, metadata?: Record<string, unknown>) {
    const { message, suggestions, code } = SchemaValidationError.generateErrorInfo(details);

    super(code, message, ValidationSeverity.error, context, suggestions, {
      ...metadata,
      schemaProcessingDetails: details,
    });

    this.details = details;
    this.name = 'SchemaValidationError';
  }

  private static generateErrorInfo(details: SchemaProcessingErrorDetails): {
    message: string;
    suggestions: ValidationErrorSuggestion[];
    code: string;
  } {
    switch (details.errorType) {
      case 'VALIDATION_FAILED':
        return {
          code: 'SCHEMA_VALIDATION_FAILED',
          message: `Schema '${details.schemaId}' validation failed${details.errors ? ` with ${details.errors.length} error(s)` : ''}`,
          suggestions: [
            {
              type: 'fix',
              message: 'Check required fields and field types in schema definition',
              action: 'Review schema structure and ensure all required fields are properly defined',
            },
            {
              type: 'documentation',
              message: 'Review schema validation requirements',
              url: '/docs/schema-validation',
            },
          ],
        };

      case 'PROCESSING_FAILED':
        return {
          code: 'SCHEMA_PROCESSING_FAILED',
          message: `Failed to process schema '${details.schemaId}'${details.processingStage ? ` during ${details.processingStage}` : ''}`,
          suggestions: [
            {
              type: 'fix',
              message: 'Verify schema format and field processor availability',
              action: 'Ensure all field types in schema have registered processors',
            },
            {
              type: 'alternative',
              message: 'Try processing schema with debug mode enabled for detailed information',
              action: 'Enable schema processing debug logging',
            },
          ],
        };

      case 'FIELD_RESOLUTION_FAILED':
        return {
          code: 'SCHEMA_FIELD_RESOLUTION_FAILED',
          message: `Could not resolve fields in schema '${details.schemaId}'${details.failedFields ? `: ${details.failedFields.join(', ')}` : ''}`,
          suggestions: [
            {
              type: 'fix',
              message: 'Register field processors for unsupported field types',
              action: 'Check that field processors are properly registered for all used field types',
            },
            {
              type: 'documentation',
              message: 'View supported field types and processor registration',
              url: '/docs/field-processors',
            },
          ],
        };

      default:
        return {
          code: 'SCHEMA_UNKNOWN_ERROR',
          message: `Unknown error processing schema '${details.schemaId}'`,
          suggestions: [
            {
              type: 'documentation',
              message: 'Check troubleshooting guide for schema processing issues',
              url: '/docs/troubleshooting',
            },
          ],
        };
    }
  }

  /**
   * Create a validation failed error with specific validation errors
   */
  static validationFailed(schemaId: string, errors: readonly unknown[], context?: ValidationErrorContext): SchemaValidationError {
    return new SchemaValidationError(
      {
        schemaId,
        errorType: 'VALIDATION_FAILED',
        errors,
        processingStage: 'validation',
      },
      context
    );
  }

  /**
   * Create a processing failed error for a specific stage
   */
  static processingFailed(schemaId: string, stage: SchemaProcessingErrorDetails['processingStage'], context?: ValidationErrorContext): SchemaValidationError {
    return new SchemaValidationError(
      {
        schemaId,
        errorType: 'PROCESSING_FAILED',
        processingStage: stage,
      },
      context
    );
  }

  /**
   * Create a field resolution failed error
   */
  static fieldResolutionFailed(schemaId: string, failedFields: readonly string[], context?: ValidationErrorContext): SchemaValidationError {
    return new SchemaValidationError(
      {
        schemaId,
        errorType: 'FIELD_RESOLUTION_FAILED',
        failedFields,
        processingStage: 'field_processing',
      },
      context
    );
  }

  /**
   * Get recovery suggestions based on error details
   */
  getRecoverySuggestions(): ValidationErrorSuggestion[] {
    const baseSuggestions = this.suggestions || [];

    // Add dynamic suggestions based on error details
    const dynamicSuggestions: ValidationErrorSuggestion[] = [];

    if (this.details.failedFields && this.details.failedFields.length > 0) {
      dynamicSuggestions.push({
        type: 'fix',
        message: `Focus on fixing these specific fields: ${this.details.failedFields.join(', ')}`,
        action: 'Address field-specific validation issues',
      });
    }

    if (this.details.errors && this.details.errors.length > 5) {
      dynamicSuggestions.push({
        type: 'alternative',
        message: 'Consider breaking down large schema into smaller, more manageable schemas',
        action: 'Split complex schema into multiple focused schemas',
      });
    }

    return [...baseSuggestions, ...dynamicSuggestions];
  }

  /**
   * Convert error to a structured format for logging/monitoring
   */
  toStructuredLog(): Record<string, unknown> {
    return {
      errorType: 'SchemaValidationError',
      code: this.code,
      message: this.message,
      schemaId: this.details.schemaId,
      processingStage: this.details.processingStage,
      errorCount: this.details.errors?.length || 0,
      failedFieldCount: this.details.failedFields?.length || 0,
      context: this.context,
      timestamp: new Date().toISOString(),
      suggestions: this.getRecoverySuggestions().length,
    };
  }
}
