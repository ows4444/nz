import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';
import type { FieldTypeValue } from '../types/field.types';

export const FIELD_VALIDATOR_METADATA_KEY = Symbol('field-validator');

export interface FieldValidatorMetadata {
  type: FieldTypeValue;
  priority?: number;
  category?: 'primitive' | 'specialized' | 'complex';
}

/**
 * Decorator to mark a class as a field validator and specify its metadata
 * This enables automatic registration in the unified FieldHandlerRegistry
 *
 * @param metadata - Configuration for the field validator
 * @example
 * ```typescript
 * @FieldValidator({ type: FieldType.string, priority: 1, category: 'primitive' })
 * @Injectable()
 * export class StringFieldValidator extends BaseFieldValidator<StringFieldSchema> {
 *   // ...
 * }
 * ```
 */

export function FieldValidator(metadata: FieldValidatorMetadata) {
  return function <T extends new (...args: unknown[]) => unknown>(target: T) {
    // Set metadata for NestJS module discovery
    SetMetadata(FIELD_VALIDATOR_METADATA_KEY, metadata)(target);

    // Set reflect-metadata for runtime discovery
    Reflect.defineMetadata(FIELD_VALIDATOR_METADATA_KEY, metadata, target);

    return target;
  };
}

/**
 * Utility function to get field validator metadata from a class
 */
export function getFieldValidatorMetadata(target: object): FieldValidatorMetadata | undefined {
  return Reflect.getMetadata(FIELD_VALIDATOR_METADATA_KEY, target) as FieldValidatorMetadata | undefined;
}

/**
 * Type guard to check if a class has field validator metadata
 */
export function isFieldValidator(target: unknown): target is new (...args: unknown[]) => unknown {
  return typeof target === 'function' && Reflect.hasMetadata(FIELD_VALIDATOR_METADATA_KEY, target);
}
