// Type guards for better runtime type safety
import type { FieldSchema } from '../interfaces/schema';
import type { FieldTypeValue } from './field.types';
import { FieldType } from './field.types';

/**
 * Type guard to check if value is a non-null object
 */
export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard to check if value is a valid field schema
 */
export function isFieldSchema(value: unknown): value is FieldSchema {
  return isNonNullObject(value) && 'type' in value && typeof value.type === 'string';
}

/**
 * Type guard to check if value is a valid field type
 */
export function isValidFieldType(value: unknown): value is FieldTypeValue {
  return typeof value === 'string' && Object.values(FieldType).includes(value as FieldTypeValue);
}

/**
 * Type guard to check if value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Type guard to check if value is a record of field schemas
 */
export function isSchemaRecord(value: unknown): value is Record<string, FieldSchema> {
  return isNonNullObject(value) && Object.values(value).every(isFieldSchema);
}

/**
 * Type guard to check if value is a primitive type
 */
export function isPrimitiveValue(value: unknown): value is string | number | boolean {
  const type = typeof value;
  return type === 'string' || type === 'number' || type === 'boolean';
}

/**
 * Type guard for class constructor
 */
export function isClassConstructor<T = object>(value: unknown): value is new (...args: unknown[]) => T {
  return typeof value === 'function' && value.prototype && (value as { prototype: { constructor: unknown } }).prototype.constructor === value;
}

/**
 * Type predicate to narrow unknown to specific type
 */
export function hasProperty<K extends PropertyKey>(obj: unknown, prop: K): obj is Record<K, unknown> {
  return isNonNullObject(obj) && prop in obj;
}

/**
 * Type guard for validation context
 */
export function hasValidationContext(value: unknown): value is { path?: string; parent?: unknown } {
  return isNonNullObject(value) && ('path' in value || 'parent' in value);
}

/**
 * Generic type narrowing helper
 */
export function assertType<T>(value: unknown, typeguard: (value: unknown) => value is T): asserts value is T {
  if (!typeguard(value)) {
    throw new Error(`Type assertion failed: expected specific type, got ${typeof value}`);
  }
}

/**
 * Type guard for enum values
 */
export function isEnumValue<T extends Record<string | number, string | number>>(enumObject: T, value: unknown): value is T[keyof T] {
  return Object.values(enumObject).includes(value as T[keyof T]);
}

/**
 * Type guard for function types
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}
