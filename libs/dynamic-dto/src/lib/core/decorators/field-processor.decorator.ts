import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';
import type { FieldTypeValue } from '../types/field.types';

export const FIELD_PROCESSOR_METADATA_KEY = Symbol('field-processor');

export interface FieldProcessorMetadata {
  type: FieldTypeValue;
  priority?: number;
  category?: 'primitive' | 'specialized' | 'complex';
}

/**
 * Decorator to mark a class as a field processor and specify its metadata
 * This enables automatic registration in the FieldProcessorRegistry
 *
 * @param metadata - Configuration for the field processor
 * @example
 * ```typescript
 * @FieldProcessor({ type: FieldType.string, priority: 1, category: 'primitive' })
 * @Injectable()
 * export class StringFieldProcessor extends BaseFieldProcessor<StringFieldSchema> {
 *   // ...
 * }
 * ```
 */

export function FieldProcessor(metadata: FieldProcessorMetadata) {
  return function <T extends new (...args: any[]) => any>(target: T) {
    // Set metadata for NestJS module discovery
    SetMetadata(FIELD_PROCESSOR_METADATA_KEY, metadata)(target);

    // Set reflect-metadata for runtime discovery
    Reflect.defineMetadata(FIELD_PROCESSOR_METADATA_KEY, metadata, target);

    return target;
  };
}

/**
 * Utility function to get field processor metadata from a class
 */
export function getFieldProcessorMetadata(target: any): FieldProcessorMetadata | undefined {
  return Reflect.getMetadata(FIELD_PROCESSOR_METADATA_KEY, target);
}

/**
 * Type guard to check if a class has field processor metadata
 */
export function isFieldProcessor(target: any): target is new (...args: any[]) => any {
  return Reflect.hasMetadata(FIELD_PROCESSOR_METADATA_KEY, target);
}
