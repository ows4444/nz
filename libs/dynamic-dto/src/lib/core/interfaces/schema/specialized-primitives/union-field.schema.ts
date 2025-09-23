import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema } from '../base/base-field.schema';
import type { ArrayFieldSchema, ObjectFieldSchema } from '../complex';
import type { BooleanFieldSchema, NumberFieldSchema, StringFieldSchema } from '../primitive';
import type { DateFieldSchema } from './date-field.schema';

// // Forward declaration to avoid circular dependency
// type FieldSchemaUnion = BaseFieldSchema & {
//   readonly type: string;
// };

export interface UnionFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.union;
  readonly unionTypes: readonly (StringFieldSchema | NumberFieldSchema | ObjectFieldSchema | BooleanFieldSchema | DateFieldSchema | ArrayFieldSchema)[];
  readonly discriminator?: UnionDiscriminator;
  readonly default?: UnionDefaultValue;

  // Validation strategy
  readonly strategy?: UnionValidationStrategy;
  readonly allowAmbiguous?: boolean; // Allow values that match multiple types
  readonly preferredType?: string; // Preferred type when ambiguous

  // Type resolution
  readonly typeHints?: readonly TypeHint[];
  readonly customResolver?: string; // Name of custom resolver function
  readonly unionMetadata?: UnionMetadata;
}

export interface UnionDiscriminator {
  readonly property: string; // Property name used for discrimination
  readonly mapping: Record<string | number, number>; // Value -> unionTypes index
  readonly required?: boolean; // Is discriminator property required
}

export interface UnionDefaultValue {
  readonly type: 'first' | 'preferred' | 'computed';
  readonly typeIndex?: number; // Index in unionTypes array
  readonly value?: unknown;
  readonly expression?: string;
}

export interface TypeHint {
  readonly condition: TypeCondition;
  readonly typeIndex: number; // Index in unionTypes array
  readonly weight?: number; // Priority weight (higher = more preferred)
}

export interface TypeCondition {
  readonly type: 'property' | 'value' | 'pattern' | 'custom';
  readonly property?: string; // For property-based conditions
  readonly value?: unknown; // Expected value
  readonly pattern?: string; // Regex pattern
  readonly validator?: string; // Custom validator function name (deprecated, use validatorName)
  readonly validatorName?: string; // Name of the custom validator to use
  readonly validatorConfig?: Record<string, unknown>; // Configuration passed to the custom validator
}

export const UnionValidationStrategy = {
  oneOf: 'oneOf', // Value must match exactly one type
  firstMatch: 'firstMatch', // Use first matching type
  anyOf: 'anyOf', // Value can match any type
  allValid: 'allValid', // Value must be valid for all types
  bestMatch: 'bestMatch', // Use type with highest confidence score
  discriminated: 'discriminated', // Use discriminator property
} as const;

export type UnionValidationStrategy = (typeof UnionValidationStrategy)[keyof typeof UnionValidationStrategy];

export interface UnionMetadata {
  readonly description?: string;
  readonly examples?: readonly unknown[];
  readonly useCases?: readonly string[];
  readonly performance?: {
    readonly fastPath?: number; // Most common type index for optimization
    readonly cacheStrategy?: 'none' | 'type_detection' | 'full';
  };
}

// Helper types for common union patterns
export interface StringOrNumberUnion extends Omit<UnionFieldSchema, 'unionTypes'> {
  readonly unionTypes: readonly [{ type: typeof FieldType.string }, { type: typeof FieldType.number }];
}

export interface NullableUnion<T> extends Omit<UnionFieldSchema, 'unionTypes'> {
  readonly unionTypes: readonly [T, { type: 'null' }];
}

export interface OptionalUnion<T> extends Omit<UnionFieldSchema, 'unionTypes'> {
  readonly unionTypes: readonly [T, { type: 'undefined' }];
}

// Discriminated Union helpers
export interface DiscriminatedUnion extends UnionFieldSchema {
  readonly discriminator: Required<UnionDiscriminator>;
  readonly strategy: typeof UnionValidationStrategy.discriminated;
}
