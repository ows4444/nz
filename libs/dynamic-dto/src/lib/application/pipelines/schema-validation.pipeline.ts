import { Injectable } from '@nestjs/common';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { ValidationResultFactory } from '../../core/interfaces/validation/validation-result.interface';
import { SchemaOrchestratorService } from '../services/schema-orchestrator.service';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import { FieldSchema } from '../../core/interfaces/schema';

export interface SchemaValidationPipelineOptions {
  userId?: string;
  userRoles?: string[];
  includeIntegrityCheck?: boolean;
}

@Injectable()
export class SchemaValidationPipeline {
  constructor(private readonly schemaOrchestrator: SchemaOrchestratorService) {}

  execute(
    schema: DynamicSchemaEntity | Record<string, FieldSchema>,
    options: SchemaValidationPipelineOptions = {}
  ): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    const { userRoles } = options;

    const schemaProperties: Record<string, FieldSchema> = schema instanceof DynamicSchemaEntity ? schema.properties : schema;

    // Enhanced validation with context
    const context: Partial<ValidationContext> = {
      ...(userRoles !== undefined && { userRoles }),
    };

    const baseResult = this.schemaOrchestrator.validateSchema(schemaProperties, context);

    // Collect all issues from base validation
    const allIssues: ValidationIssue[] = [...baseResult.issues];

    // Add additional business logic validation if needed
    if (schema instanceof DynamicSchemaEntity) {
      const businessValidationResult = this.validateBusinessRules(schema);
      if (!businessValidationResult.isValid) {
        allIssues.push(...businessValidationResult.issues);
      }
    }

    return ValidationResultFactory.create({
      isValid: allIssues.filter((issue) => issue.severity === ValidationSeverity.error).length === 0,
      issues: allIssues,
      ...(schema instanceof DynamicSchemaEntity && schema.name && { fieldPath: schema.name }),
    });
  }

  private validateBusinessRules(schema: DynamicSchemaEntity): ValidationResult & {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly infos: ValidationIssue[];
  } {
    const issues: ValidationIssue[] = [];

    // Example business rule: Required fields must have a type
    for (const requiredField of schema.getRequiredFields()) {
      if (!schema.hasField(requiredField)) {
        issues.push({
          message: `Required field "${requiredField}" is missing in schema "${schema.name}".`,
          severity: ValidationSeverity.error,
          code: 'MISSING_REQUIRED_FIELD',
          fieldPath: schema.name,
        });
      }
    }

    return ValidationResultFactory.create({
      isValid: issues.filter((issue) => issue.severity === ValidationSeverity.error).length === 0,
      issues,
      fieldPath: schema.name,
    });
  }
}
