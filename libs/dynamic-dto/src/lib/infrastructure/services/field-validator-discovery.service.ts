import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { BaseFieldValidator } from '../../core/abstractions/base-field-validator.abstract';
import { FIELD_VALIDATOR_METADATA_KEY, FieldValidatorMetadata } from '../../core/decorators/field-validator.decorator';
import { FieldTypeValue } from '../../core/types/field.types';

export interface DiscoveredValidator {
  instance: BaseFieldValidator;
  metadata: FieldValidatorMetadata;
  type: new (...args: unknown[]) => BaseFieldValidator;
}

@Injectable()
export class FieldValidatorDiscoveryService {
  private readonly logger = new Logger(FieldValidatorDiscoveryService.name);

  constructor(private readonly discoveryService: DiscoveryService, private readonly reflector: Reflector) {}

  /**
   * Auto-discover all validators decorated with @FieldValidator
   */
  discoverValidators(): DiscoveredValidator[] {
    const validators: DiscoveredValidator[] = [];

    // Get all providers/controllers/components from the application
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      if (!wrapper.metatype || !wrapper.instance) {
        continue;
      }

      // Check if the provider has field validator metadata
      const metadata = this.reflector.get<FieldValidatorMetadata>(FIELD_VALIDATOR_METADATA_KEY, wrapper.metatype);

      if (metadata && wrapper.instance instanceof BaseFieldValidator) {
        validators.push({
          instance: wrapper.instance as BaseFieldValidator,
          metadata,
          type: wrapper.metatype as new (...args: unknown[]) => BaseFieldValidator,
        });

        this.logger.debug(`Discovered validator: ${wrapper.metatype.name} for type: ${metadata.type}`);
      }
    }

    if (validators.length === 0) {
      this.logger.warn('No validators discovered. Ensure validators are decorated with @FieldValidator');
    } else {
      this.logger.log(`Auto-discovered ${validators.length} field validators`);
    }

    return validators;
  }

  /**
   * Validate that a discovered validator is properly configured
   */
  validateValidatorCompatibility(discovered: DiscoveredValidator): boolean {
    const { instance, metadata, type } = discovered;

    try {
      // Validate metadata matches instance
      if (instance.supportedType !== metadata.type) {
        this.logger.warn(`Validator ${type.name} metadata type (${metadata.type}) doesn't match supportedType (${instance.supportedType})`);
        return false;
      }

      // Validate required methods exist
      if (typeof instance.canValidate !== 'function' || typeof instance.validate !== 'function') {
        this.logger.warn(`Validator ${type.name} is missing required methods`);
        return false;
      }

      // Validate priority is reasonable
      if (instance.priority < 0 || instance.priority > 1000) {
        this.logger.warn(`Validator ${type.name} has unreasonable priority: ${instance.priority}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to validate compatibility for validator ${type.name}:`, error);
      return false;
    }
  }

  /**
   * Group validators by category for better organization
   */
  getValidatorsByCategory(): Record<string, DiscoveredValidator[]> {
    const validators = this.discoverValidators();
    const categories: Record<string, DiscoveredValidator[]> = {
      primitive: [],
      specialized: [],
      complex: [],
      unknown: [],
    };

    for (const validator of validators) {
      const category = validator.metadata.category ?? 'unknown';
      if (categories[category]) {
        categories[category].push(validator);
      } else {
        categories[category] = [validator];
      }
    }

    return categories;
  }

  /**
   * Get all validators sorted by priority
   */
  getValidatorsByPriority(): DiscoveredValidator[] {
    return this.discoverValidators().sort((a, b) => (b.metadata.priority ?? a.instance.priority) - (a.metadata.priority ?? b.instance.priority));
  }

  /**
   * Find validator for specific field type
   */
  findValidatorForType(type: FieldTypeValue): DiscoveredValidator | undefined {
    const validators = this.discoverValidators();
    return validators.find((v) => v.metadata.type === type);
  }
}
