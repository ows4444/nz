import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema } from '../base/base-field.schema';

export interface EnumFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.enum;
  readonly values: readonly (string | number)[];
  readonly default?: string | number | EnumDefaultValue;

  // Validation options
  readonly caseSensitive?: boolean;
  readonly allowMultiple?: boolean; // For flags/multi-select enums
  readonly strict?: boolean; // Reject values not in enum

  // Display/Transformation
  readonly labels?: Record<string | number, string>; // Human-readable labels
  readonly transform?: EnumTransform;
  readonly sort?: EnumSortOrder;

  // Validation metadata
  readonly deprecatedValues?: readonly (string | number)[];
}

export interface EnumDefaultValue {
  readonly type: 'first' | 'random' | 'computed';
  readonly expression?: string;
}

export const EnumTransform = {
  none: 'none',
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
  label: 'label', // Transform to label if available
} as const;

export type EnumTransform = (typeof EnumTransform)[keyof typeof EnumTransform];

export const EnumSortOrder = {
  none: 'none',
  asc: 'asc',
  desc: 'desc',
  definition: 'definition', // Keep original order
  alphabetical: 'alphabetical',
  frequency: 'frequency', // Sort by usage frequency
} as const;

export type EnumSortOrder = (typeof EnumSortOrder)[keyof typeof EnumSortOrder];

// Helper types for type-safe enum definitions
export interface StringEnum<T extends readonly string[]> extends Omit<EnumFieldSchema, 'values' | 'default'> {
  readonly values: T;
  readonly default?: T[number] | EnumDefaultValue;
}

export interface NumberEnum<T extends readonly number[]> extends Omit<EnumFieldSchema, 'values' | 'default'> {
  readonly values: T;
  readonly default?: T[number] | EnumDefaultValue;
}

export interface MixedEnum<T extends readonly (string | number)[]> extends EnumFieldSchema {
  readonly values: T;
  readonly default?: T[number] | EnumDefaultValue;
}
