import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../../../core/abstractions/validation-strategy.abstract';
import { DynamicSchemaEntity } from '../../../domain/entities/dynamic-schema.entity';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { SchemaValidationPipeline } from '../../pipelines/schema-validation.pipeline';

@Injectable()
export class EnhancedSchemaValidationStrategy extends ValidationStrategy {
  readonly name = 'EnhancedSchemaValidation';
  readonly order = 10;

  private readonly logger = new Logger(EnhancedSchemaValidationStrategy.name);

  constructor(private readonly schemaValidationPipeline: SchemaValidationPipeline) {
    super();
  }

  execute(schema: DynamicSchemaEntity, _context?: ValidationContext): ValidationResult {
    this.logger.debug(`Executing ${this.name} for schema: ${schema.name}`);

    try {
      return this.schemaValidationPipeline.execute(schema);
    } catch (error) {
      this.logger.error(`${this.name} failed for schema: ${schema.name}`, error);
      throw error;
    }
  }
}
