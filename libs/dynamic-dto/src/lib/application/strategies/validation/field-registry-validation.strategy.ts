import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { FieldValidatorRegistry } from '../../../infrastructure/registries/field-validator.registry';
import { ValidationResultMerger } from '../../../core/utils/validation-result-merger';

@Injectable()
export class FieldRegistryValidationStrategy extends ValidationStrategy {
  readonly name = 'FieldRegistryValidation';
  readonly order = 30;

  private readonly logger = new Logger(FieldRegistryValidationStrategy.name);

  constructor(private readonly fieldValidatorRegistry: FieldValidatorRegistry) {
    super();
  }

  execute(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      return this.validateFieldsWithRegistry(schema, context);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }

  private validateFieldsWithRegistry(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    const results: ValidationResult[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const fieldContext: ValidationContext = {
        fieldPath: fieldName,
        depth: 0,
        parentType: 'schema',
        schemaName: schema.name,
        ...(context?.userRoles !== undefined && { userRoles: context.userRoles }),
        data: context?.data,
      };

      const result = this.fieldValidatorRegistry.validateField(fieldSchema, fieldContext);
      results.push(result);
    }

    return ValidationResultMerger.mergeResults(results);
  }
}
