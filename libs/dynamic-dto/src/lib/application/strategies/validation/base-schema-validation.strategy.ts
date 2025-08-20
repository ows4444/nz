import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { BaseSchemaValidator } from '../../../core/abstractions/base-schema-validator.abstract';

@Injectable()
export class BaseSchemaValidationStrategy extends ValidationStrategy {
  readonly name = 'BaseSchemaValidation';
  readonly order = 20;

  private readonly logger = new Logger(BaseSchemaValidationStrategy.name);

  constructor(private readonly schemaValidator: BaseSchemaValidator) {
    super();
  }

  execute(schema: DynamicSchemaEntity, _context?: ValidationContext): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      return this.schemaValidator.validate(schema.properties, undefined, schema.name);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }
}
