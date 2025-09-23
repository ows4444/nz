import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseFieldValidator } from '../../core/abstractions/base-field-validator.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { FieldTypeValue } from '../../core/types/field.types';
import { ValidationResultBuilder } from '../../core/utils/validation-result.builder';
import { FieldValidatorDiscoveryService } from '../services/field-validator-discovery.service';

interface ValidatorStats {
  totalValidators: number;
  validatorsByCategory: Record<string, string[]>;
  supportedTypes: FieldTypeValue[];
}

/**
 * Dedicated registry for field validators using auto-discovery
 * Eliminates manual registration and hardcoded mappings
 */
@Injectable()
export class FieldValidatorRegistry implements OnModuleInit {
  private readonly logger = new Logger(FieldValidatorRegistry.name);
  private readonly validators = new Map<FieldTypeValue, BaseFieldValidator>();
  private initialized = false;

  constructor(private readonly discoveryService: FieldValidatorDiscoveryService) {}

  onModuleInit(): void {
    if (this.initialized) return;

    try {
      this.initializeValidators();
      this.initialized = true;
      this.logger.log(`Initialized field validator registry with ${this.validators.size} validators`);
    } catch (error) {
      this.logger.error('Failed to initialize field validators', error);
      throw error;
    }
  }

  private initializeValidators(): void {
    // Auto-discover all validators
    const discoveredValidators = this.discoveryService.discoverValidators();

    if (discoveredValidators.length === 0) {
      this.logger.warn('No field validators discovered. Ensure validators are decorated with @FieldValidator');
      return;
    }

    // Register discovered validators
    for (const discovered of discoveredValidators) {
      if (this.discoveryService.validateValidatorCompatibility(discovered)) {
        this.registerValidator(discovered.instance);
        this.logger.debug(`Auto-registered validator: ${discovered.type.name} for type: ${discovered.metadata.type}`);
      } else {
        this.logger.warn(`Skipping invalid validator: ${discovered.type.name}`);
      }
    }

    // Log validator categories for better debugging
    const categories = this.discoveryService.getValidatorsByCategory();
    for (const [category, validators] of Object.entries(categories)) {
      if (validators.length > 0) {
        this.logger.debug(`${category} validators: ${validators.map((v) => v.type.name).join(', ')}`);
      }
    }
  }

  /**
   * Register a validator (supports runtime registration)
   */
  registerValidator(validator: BaseFieldValidator): void {
    if (!validator?.supportedType) {
      this.logger.warn('Invalid validator provided');
      return;
    }

    const existingValidator = this.validators.get(validator.supportedType);
    if (existingValidator && existingValidator.priority > validator.priority) {
      this.logger.debug(`Keeping higher priority validator for type ${validator.supportedType}`);
      return;
    }

    this.validators.set(validator.supportedType, validator);
    this.logger.debug(`Registered validator: ${validator.name} for type: ${validator.supportedType}`);
  }

  /**
   * Get validator for a specific field type
   */
  getValidator(type: FieldTypeValue): BaseFieldValidator | undefined {
    return this.validators.get(type);
  }

  /**
   * Register a validator for a specific field type
   */
  register(type: FieldTypeValue, validator: BaseFieldValidator): void {
    this.validators.set(type, validator);
    this.logger.debug(`Manually registered validator: ${validator.constructor.name} for type: ${type}`);
  }

  /**
   * Get validators for a specific field type (returns array for consistency with tests)
   */
  getValidatorsForType(type: FieldTypeValue): BaseFieldValidator[] {
    const validator = this.getValidator(type);
    return validator ? [validator] : [];
  }

  /**
   * Get the total number of registered validators
   */
  getValidatorCount(): number {
    return this.validators.size;
  }

  /**
   * Check if validator exists for field type
   */
  hasValidator(type: FieldTypeValue): boolean {
    return this.validators.has(type);
  }

  /**
   * Validate a field schema using the appropriate validator
   */
  validateField(schema: FieldSchema, context: ValidationContext): ValidationResult {
    try {
      const validator = this.getValidator(schema.type);

      if (!validator) {
        this.logger.warn(`No validator found for field type: ${schema.type}`, {
          fieldPath: context.fieldPath,
          availableValidators: Array.from(this.validators.keys()),
        });

        return ValidationResultBuilder.error('VALIDATOR_NOT_FOUND', `No validator found for field type: ${schema.type}`, context.fieldPath, { type: schema.type });
      }

      if (!validator.canValidate(schema)) {
        return ValidationResultBuilder.error(
          'VALIDATOR_INCOMPATIBLE',
          `Validator cannot handle schema for field: ${context.fieldPath}. Validator: ${validator.name}, Field type: ${schema.type}`,
          context.fieldPath
        );
      }

      return validator.validate(schema, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Field validation failed', {
        fieldPath: context.fieldPath,
        fieldType: schema.type,
        error: errorMessage,
      });

      return ValidationResultBuilder.error('VALIDATION_ERROR', `Validation failed for field '${context.fieldPath}': ${errorMessage}`, context.fieldPath, { error: errorMessage });
    }
  }

  /**
   * Get all registered validators (readonly)
   */
  getAllValidators(): ReadonlyMap<FieldTypeValue, BaseFieldValidator> {
    return new Map(this.validators);
  }

  /**
   * Get supported field types
   */
  getSupportedTypes(): FieldTypeValue[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Unregister a validator
   */
  unregisterValidator(type: FieldTypeValue): boolean {
    const removed = this.validators.delete(type);
    if (removed) {
      this.logger.debug(`Unregistered validator for type: ${type}`);
    }
    return removed;
  }

  /**
   * Get registry statistics
   */
  getStats(): ValidatorStats {
    const categories = this.discoveryService.getValidatorsByCategory();
    const categoriesMap: Record<string, string[]> = {};

    for (const [category, validators] of Object.entries(categories)) {
      categoriesMap[category] = validators.map((v) => v.type.name);
    }

    return {
      totalValidators: this.validators.size,
      validatorsByCategory: categoriesMap,
      supportedTypes: this.getSupportedTypes(),
    };
  }

  /**
   * Clear all validators (mainly for testing)
   */
  clear(): void {
    this.validators.clear();
    this.initialized = false;
    this.logger.debug('Cleared all validators from registry');
  }
}
