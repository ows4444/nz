import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BaseFieldProcessor, type TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { AutoGenerateConfig, AutoGenerationType, StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';

/**
 * StringAutoGenerationProcessor handles auto-generation responsibilities:
 * - UUID generation (v4)
 * - Timestamp generation (ISO string)
 * - Random string generation (configurable length and charset)
 * - Slug generation (URL-friendly strings)
 * - Hash generation (Base64-encoded hashes)
 * - Sequential/incremental generation
 */
@Injectable()
export class StringAutoGenerationProcessor extends BaseFieldProcessor<StringFieldSchema> {
  // Static counters for sequential generation
  private static readonly sequence_counters = new Map<string, number>();

  readonly supportedType = FieldType.string;

  canProcess(schema: FieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string && !!schema.autoGenerate;
  }

  generateValidationDecorators(_schema: StringFieldSchema, _isRequired: boolean, _parentIsArray: boolean): PropertyDecorator[] {
    // StringAutoGenerationProcessor doesn't add validation decorators - it only generates values
    return [];
  }

  getTypeSpecificTransformations(schema: StringFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    if (!schema.autoGenerate) {
      return functions;
    }

    // Auto-generation transformation (order: 30 - runs early in the pipeline)
    functions.push({
      order: 30,
      name: 'auto_generate',
      transform: ({ value }) => {
        switch (schema.autoGenerate) {
          case AutoGenerationType.uuid:
            return this.generateUuid(schema.autoGenerateConfig);
          case AutoGenerationType.ulid:
            return this.generateUlid(schema.autoGenerateConfig);
          case AutoGenerationType.nanoid:
            return this.generateNanoid(schema.autoGenerateConfig);
          case AutoGenerationType.timestamp:
            return this.generateTimestamp(schema.autoGenerateConfig);
          case AutoGenerationType.incremental:
            return this.generateIncremental(schema.autoGenerateConfig);
          case AutoGenerationType.slug:
            return this.generateSlug(schema.autoGenerateConfig);
          case AutoGenerationType.hash:
            return this.generateHash(schema.autoGenerateConfig);
          case AutoGenerationType.random_string:
            return this.generateRandomString(schema.autoGenerateConfig);
          case AutoGenerationType.sequence:
            return this.generateSequence(schema.autoGenerateConfig);
          default:
            return value;
        }
      },
      condition: (_, { value }) => {
        // Only generate if value is undefined or if readonly is true
        if (schema.readonly === true) return true;
        return value === undefined;
      },
    });

    return functions;
  }

  private generateUuid(config?: AutoGenerateConfig): string {
    const uuid = uuidv4();
    return this.applyPrefixSuffix(uuid, config);
  }

  private generateUlid(config?: AutoGenerateConfig): string {
    // ULID implementation - Universally Unique Lexicographically Sortable Identifier
    // Simplified implementation (proper ULID would require external library)
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 12).toUpperCase();
    const ulid = timestamp + randomPart;
    return this.applyPrefixSuffix(ulid, config);
  }

  private generateNanoid(config?: AutoGenerateConfig): string {
    // NanoID implementation - URL-safe unique ID generator
    // Simplified implementation (proper NanoID would require external library)
    const alphabet = config?.charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const length = config?.length ?? 21;

    let result = '';
    for (let i = 0; i < length; i++) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return this.applyPrefixSuffix(result, config);
  }

  private generateTimestamp(config?: AutoGenerateConfig): string {
    const timestamp = new Date().toISOString();
    return this.applyPrefixSuffix(timestamp, config);
  }

  private generateIncremental(config?: AutoGenerateConfig): string {
    const counterKey = config?.template ?? 'default';
    const start = config?.counter?.start ?? 1;
    const step = config?.counter?.step ?? 1;
    const padLength = config?.counter?.padLength ?? 0;

    // Get or initialize counter
    const currentValue = StringAutoGenerationProcessor.sequence_counters.get(counterKey) ?? start;
    StringAutoGenerationProcessor.sequence_counters.set(counterKey, currentValue + step);

    // Apply padding if specified
    const paddedValue = padLength > 0 ? currentValue.toString().padStart(padLength, '0') : currentValue.toString();

    return this.applyPrefixSuffix(paddedValue, config);
  }

  private generateSlug(config?: AutoGenerateConfig): string {
    const base = config?.template ?? 'auto-generated';
    const timestamp = Date.now().toString(36);
    const slug = `${base}-${timestamp}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return this.applyPrefixSuffix(slug, config);
  }

  private generateHash(config?: AutoGenerateConfig): string {
    const input = config?.template ?? Date.now().toString();
    const hash = btoa(input + Math.random().toString())
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, config?.length ?? 16);

    return this.applyPrefixSuffix(hash, config);
  }

  private generateRandomString(config?: AutoGenerateConfig): string {
    const length = config?.length ?? 8;
    const chars = config?.charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charsLength = chars.length;

    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = chars[Math.floor(Math.random() * charsLength)];
    }

    const randomString = result.join('');
    return this.applyPrefixSuffix(randomString, config);
  }

  private generateSequence(config?: AutoGenerateConfig): string {
    // Similar to incremental but with more complex patterns
    const template = config?.template ?? 'SEQ-{counter}';
    const counterKey = `sequence_${template}`;
    const start = config?.counter?.start ?? 1;
    const step = config?.counter?.step ?? 1;
    const padLength = config?.counter?.padLength ?? 0;

    // Get or initialize counter
    const currentValue = StringAutoGenerationProcessor.sequence_counters.get(counterKey) ?? start;
    StringAutoGenerationProcessor.sequence_counters.set(counterKey, currentValue + step);

    // Apply padding if specified
    const paddedValue = padLength > 0 ? currentValue.toString().padStart(padLength, '0') : currentValue.toString();

    // Replace template placeholders
    const sequence = template.replace('{counter}', paddedValue);

    return this.applyPrefixSuffix(sequence, config);
  }

  private applyPrefixSuffix(value: string, config?: AutoGenerateConfig): string {
    let result = value;

    if (config?.prefix) {
      result = config.prefix + result;
    }

    if (config?.suffix) {
      result = result + config.suffix;
    }

    return result;
  }

  /**
   * Reset all sequence counters (useful for testing)
   */
  static resetSequenceCounters(): void {
    StringAutoGenerationProcessor.sequence_counters.clear();
  }

  /**
   * Reset specific sequence counter
   */
  static resetSequenceCounter(key: string): void {
    StringAutoGenerationProcessor.sequence_counters.delete(key);
  }
}
