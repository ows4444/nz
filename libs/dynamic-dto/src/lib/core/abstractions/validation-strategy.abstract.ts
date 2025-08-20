import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { ValidationContext, ValidationResult } from '../interfaces/validation';

export abstract class ValidationStrategy {
  abstract readonly name: string;
  abstract readonly order: number;

  abstract execute(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult;

  protected shouldExecute(_schema: DynamicSchemaEntity, _context?: ValidationContext): boolean {
    return true;
  }

  public canExecute(schema: DynamicSchemaEntity, context?: ValidationContext): boolean {
    return this.shouldExecute(schema, context);
  }
}
