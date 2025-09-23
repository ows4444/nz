import { Injectable } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { UnionFieldSchema, UnionValidationStrategy } from '../../../../core/interfaces/schema/specialized-primitives/union-field.schema';
import { UnionTypeDetectorService } from './union-type-detector.service';
import { UnionDiscriminatorHandlerService } from './union-discriminator-handler.service';

/**
 * Result of validation against a specific union type
 */
interface ValidationError {
  readonly property: string;
  readonly constraints: Record<string, string>;
  readonly value: unknown;
  readonly message: string;
}

/**
 * Result of type matching validation
 */
interface TypeMatchResult {
  readonly typeIndex: number;
  readonly confidence: number;
  readonly valid: boolean;
  readonly errors: ValidationError[];
}

/**
 * Service responsible for union type validation logic.
 * Extracted from the main processor to improve testability and maintainability.
 */
@Injectable()
export class UnionValidatorService {
  constructor(private readonly typeDetector: UnionTypeDetectorService, private readonly discriminatorHandler: UnionDiscriminatorHandlerService) {}

  /**
   * Creates a union validator decorator for class-validator
   * @param schema The union schema
   * @param validationOptions Optional validation options
   * @returns Property decorator for union validation
   */
  createUnionValidator(schema: UnionFieldSchema, validationOptions?: ValidationOptions): PropertyDecorator {
    return <T extends object>(target: T, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isUnion',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate: (value: unknown): boolean => {
            return this.validateUnionValue(value, schema);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must match one of the union types`;
          },
        },
      });
    };
  }

  /**
   * Creates a discriminator validator decorator
   * @param schema The union schema with discriminator
   * @param validationOptions Optional validation options
   * @returns Property decorator for discriminator validation
   */
  createDiscriminatorValidator(schema: UnionFieldSchema, validationOptions?: ValidationOptions): PropertyDecorator {
    return <T extends object>(target: T, propertyName: string | symbol) => {
      registerDecorator({
        name: 'hasDiscriminator',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate: (value: unknown): boolean => {
            return this.discriminatorHandler.validateDiscriminatorProperty(value, schema);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must have a valid discriminator property: ${schema.discriminator?.property}`;
          },
        },
      });
    };
  }

  /**
   * Validates a value against union schema
   * @param value The value to validate
   * @param schema The union schema
   * @returns True if value is valid
   */
  validateUnionValue(value: unknown, schema: UnionFieldSchema): boolean {
    if (value === undefined || value === null) {
      return true; // Let required/optional validators handle nullability
    }

    const strategy = schema.strategy ?? UnionValidationStrategy.firstMatch;
    const matchResults = this.validateAgainstAllTypes(value, schema);

    switch (strategy) {
      case UnionValidationStrategy.oneOf: {
        const validMatches = matchResults.filter((r) => r.valid);
        return validMatches.length === 1;
      }

      case UnionValidationStrategy.firstMatch:
        return matchResults.some((r) => r.valid);

      case UnionValidationStrategy.bestMatch: {
        const bestMatch = this.findBestMatch(matchResults);
        return bestMatch?.valid ?? false;
      }

      case UnionValidationStrategy.allValid:
        return matchResults.every((r) => r.valid);

      case UnionValidationStrategy.discriminated:
        return this.discriminatorHandler.validateDiscriminatedUnion(value, schema);

      default:
        return matchResults.some((r) => r.valid);
    }
  }

  /**
   * Validates a value against all union types and returns detailed results
   * @param value The value to validate
   * @param schema The union schema
   * @returns Array of validation results for each type
   */
  validateAgainstAllTypes(value: unknown, schema: UnionFieldSchema): TypeMatchResult[] {
    const results: TypeMatchResult[] = [];

    for (let i = 0; i < schema.unionTypes.length; i++) {
      const typeSchema = schema.unionTypes[i];
      if (!typeSchema) {
        // Skip invalid type schemas
        continue;
      }

      try {
        // Calculate confidence using type detector
        const confidence = this.typeDetector.calculateTypeConfidence(value, typeSchema, schema.typeHints ?? []);

        const valid = confidence > 0.5; // Threshold for validity

        results.push({
          typeIndex: i,
          confidence,
          valid,
          errors: valid
            ? []
            : [
                {
                  property: 'unionType',
                  constraints: {
                    unionType: 'Type does not match expected union type',
                  },
                  value,
                  message: `Value does not match union type at index ${i}`,
                },
              ],
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          typeIndex: i,
          confidence: 0,
          valid: false,
          errors: [
            {
              property: 'unionType',
              constraints: {
                validationError: 'Validation failed during type checking',
              },
              value,
              message: errorMessage,
            },
          ],
        });
      }
    }

    return results;
  }

  /**
   * Finds the best matching type from validation results
   * @param matchResults Array of type match results
   * @returns The best matching result or null
   */
  findBestMatch(matchResults: TypeMatchResult[]): TypeMatchResult | null {
    const validMatches = matchResults.filter((r) => r.valid);
    if (validMatches.length === 0) {
      return null;
    }

    return validMatches.reduce((best, current) => (current.confidence > best.confidence ? current : best));
  }

  /**
   * Gets validation strategy display name
   * @param strategy The validation strategy
   * @returns Human-readable strategy name
   */
  getStrategyDisplayName(strategy: UnionValidationStrategy): string {
    switch (strategy) {
      case UnionValidationStrategy.oneOf:
        return 'Exactly One Match';
      case UnionValidationStrategy.firstMatch:
        return 'First Match';
      case UnionValidationStrategy.bestMatch:
        return 'Best Match';
      case UnionValidationStrategy.allValid:
        return 'All Valid';
      case UnionValidationStrategy.discriminated:
        return 'Discriminated Union';
      default:
        return 'Unknown Strategy';
    }
  }

  /**
   * Validates that a union schema is properly configured
   * @param schema The union schema to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateUnionSchema(schema: UnionFieldSchema): string[] {
    const errors: string[] = [];

    // Check that union types are defined
    if (!schema.unionTypes || schema.unionTypes.length === 0) {
      errors.push('Union schema must have at least one type defined');
    }

    // Validate discriminator configuration if present
    if (schema.discriminator) {
      if (!schema.discriminator.property) {
        errors.push('Discriminator must specify a property name');
      }

      if (!schema.discriminator.mapping || Object.keys(schema.discriminator.mapping).length === 0) {
        errors.push('Discriminator must specify type mappings');
      }

      // Check that discriminator mappings reference valid type indices
      Object.values(schema.discriminator.mapping).forEach((typeIndex, i) => {
        if (typeof typeIndex !== 'number' || typeIndex < 0 || typeIndex >= schema.unionTypes.length) {
          errors.push(`Discriminator mapping at index ${i} references invalid type index: ${typeIndex}`);
        }
      });
    }

    // Validate strategy compatibility
    if (schema.strategy === UnionValidationStrategy.discriminated && !schema.discriminator) {
      errors.push('Discriminated validation strategy requires discriminator configuration');
    }

    // Validate type hints if present
    if (schema.typeHints) {
      schema.typeHints.forEach((hint, i) => {
        if (hint.typeIndex < 0 || hint.typeIndex >= schema.unionTypes.length) {
          errors.push(`Type hint at index ${i} references invalid type index: ${hint.typeIndex}`);
        }
      });
    }

    return errors;
  }

  /**
   * Checks if a union schema is valid for validation
   * @param schema The union schema to check
   * @returns True if schema is valid
   */
  isValidUnionSchema(schema: UnionFieldSchema): boolean {
    return this.validateUnionSchema(schema).length === 0;
  }
}
