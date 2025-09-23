import { Injectable } from '@nestjs/common';
import { UnionFieldSchema } from '../../../../core/interfaces/schema/specialized-primitives/union-field.schema';

/**
 * Service responsible for handling discriminated unions and discriminator-based validation.
 * Extracted from the main processor to improve maintainability and separation of concerns.
 */
@Injectable()
export class UnionDiscriminatorHandlerService {
  /**
   * Resolves a discriminated union value based on discriminator configuration
   * @param value The value to resolve
   * @param schema The union schema with discriminator configuration
   * @returns The resolved value with type information
   */
  resolveDiscriminatedUnion(value: unknown, schema: UnionFieldSchema): unknown {
    if (!schema.discriminator || typeof value !== 'object' || value === null) {
      return value;
    }

    const discriminatorValue = (value as Record<string, unknown>)[schema.discriminator.property];
    const typeIndex = schema.discriminator.mapping[discriminatorValue as string | number];

    if (typeIndex !== undefined && typeIndex >= 0 && typeIndex < schema.unionTypes.length) {
      // Store the resolved type index for validation and processing
      return { ...value, _unionTypeIndex: typeIndex };
    }

    return value;
  }

  /**
   * Validates that a discriminated union value has a valid discriminator
   * @param value The value to validate
   * @param schema The union schema with discriminator configuration
   * @returns True if discriminator is valid
   */
  validateDiscriminatedUnion(value: unknown, schema: UnionFieldSchema): boolean {
    if (!schema.discriminator || typeof value !== 'object' || value === null) {
      return false;
    }

    const discriminatorValue = (value as Record<string, unknown>)[schema.discriminator.property];
    const typeIndex = schema.discriminator.mapping[discriminatorValue as string | number];

    return typeIndex !== undefined && typeIndex >= 0 && typeIndex < schema.unionTypes.length;
  }

  /**
   * Validates that a value has the required discriminator property
   * @param value The value to validate
   * @param schema The union schema with discriminator configuration
   * @returns True if discriminator property is present and valid
   */
  validateDiscriminatorProperty(value: unknown, schema: UnionFieldSchema): boolean {
    if (!schema.discriminator) {
      return true; // No discriminator required
    }

    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const discriminatorProp = schema.discriminator.property;
    const discriminatorValue = (value as Record<string, unknown>)[discriminatorProp];

    if (discriminatorValue === undefined) {
      return !schema.discriminator.required;
    }

    return Object.keys(schema.discriminator.mapping).includes(discriminatorValue as string);
  }

  /**
   * Extracts the discriminator value from an object
   * @param value The object to extract from
   * @param discriminatorProperty The discriminator property name
   * @returns The discriminator value or undefined
   */
  extractDiscriminatorValue(value: unknown, discriminatorProperty: string): unknown {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }

    return (value as Record<string, unknown>)[discriminatorProperty];
  }

  /**
   * Gets the type index for a discriminator value
   * @param discriminatorValue The discriminator value
   * @param schema The union schema with discriminator mapping
   * @returns The type index or -1 if not found
   */
  getTypeIndexForDiscriminator(discriminatorValue: unknown, schema: UnionFieldSchema): number {
    if (!schema.discriminator) {
      return -1;
    }

    const typeIndex = schema.discriminator.mapping[discriminatorValue as string | number];
    return typeIndex !== undefined && typeIndex >= 0 && typeIndex < schema.unionTypes.length ? typeIndex : -1;
  }

  /**
   * Checks if a schema has discriminator configuration
   * @param schema The union schema to check
   * @returns True if discriminator is configured
   */
  hasDiscriminator(schema: UnionFieldSchema): boolean {
    return Boolean(schema.discriminator?.property);
  }

  /**
   * Gets all possible discriminator values for a schema
   * @param schema The union schema
   * @returns Array of discriminator values
   */
  getDiscriminatorValues(schema: UnionFieldSchema): (string | number)[] {
    if (!schema.discriminator) {
      return [];
    }

    return Object.keys(schema.discriminator.mapping).map((key) => {
      // Try to parse as number, fall back to string
      const numKey = Number(key);
      return isNaN(numKey) ? key : numKey;
    });
  }

  /**
   * Gets the discriminator property name for a schema
   * @param schema The union schema
   * @returns The discriminator property name or undefined
   */
  getDiscriminatorProperty(schema: UnionFieldSchema): string | undefined {
    return schema.discriminator?.property;
  }

  /**
   * Checks if discriminator is required for a schema
   * @param schema The union schema
   * @returns True if discriminator is required
   */
  isDiscriminatorRequired(schema: UnionFieldSchema): boolean {
    return Boolean(schema.discriminator?.required);
  }
}
