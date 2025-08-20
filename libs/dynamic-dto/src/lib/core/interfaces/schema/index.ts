import type { FieldType, FieldTypeValue } from '../../types/field.types';
import type { ArrayFieldSchema, ObjectFieldSchema } from './complex';
import type { BooleanFieldSchema, NumberFieldSchema, StringFieldSchema } from './primitive';
import type { DateFieldSchema, EnumFieldSchema, UnionFieldSchema } from './specialized-primitives';

export * from './base/base-field.schema';
export * from './complex';
export * from './primitive';
export * from './specialized-primitives';

export type FieldSchema =
  // Primitives
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema

  // Specialized Primitives
  | DateFieldSchema
  | EnumFieldSchema
  | UnionFieldSchema

  // Complex/Structured
  | ArrayFieldSchema
  | ObjectFieldSchema;

export type FieldSchemaOfType<T extends FieldTypeValue> = T extends typeof FieldType.string
  ? StringFieldSchema
  : T extends typeof FieldType.number
  ? NumberFieldSchema
  : T extends typeof FieldType.boolean
  ? BooleanFieldSchema
  : T extends typeof FieldType.date
  ? DateFieldSchema
  : T extends typeof FieldType.enum
  ? EnumFieldSchema
  : T extends typeof FieldType.union
  ? UnionFieldSchema
  : T extends typeof FieldType.array
  ? ArrayFieldSchema
  : T extends typeof FieldType.object
  ? ObjectFieldSchema
  : never;

// Utility type for stricter schema validation
export type ValidatedFieldSchema<T extends FieldSchema = FieldSchema> = T & {
  readonly _validated: true;
};

// Type constraint for ensuring schema has required properties
export type RequiredFieldSchema<T extends FieldSchema, K extends keyof T> = T & Required<Pick<T, K>>;

// Type for schema with optional properties made explicit
export type ExplicitFieldSchema<T extends FieldSchema> = T & {
  [K in keyof T]-?: T[K];
};
