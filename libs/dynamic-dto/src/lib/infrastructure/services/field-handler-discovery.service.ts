import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { BaseFieldProcessor } from '../../core/abstractions/base-field-processor.abstract';
import { BaseFieldValidator } from '../../core/abstractions/base-field-validator.abstract';
import { FIELD_PROCESSOR_METADATA_KEY, FieldProcessorMetadata, getFieldProcessorMetadata } from '../../core/decorators/field-processor.decorator';
import { FIELD_VALIDATOR_METADATA_KEY, FieldValidatorMetadata, getFieldValidatorMetadata } from '../../core/decorators/field-validator.decorator';

export interface DiscoveredProcessor {
  instance: BaseFieldProcessor;
  type: new (...args: unknown[]) => BaseFieldProcessor;
  metadata: FieldProcessorMetadata;
}

export interface DiscoveredValidator {
  instance: BaseFieldValidator;
  type: new (...args: unknown[]) => BaseFieldValidator;
  metadata: FieldValidatorMetadata;
}

export interface ProcessorsByCategory {
  primitive: DiscoveredProcessor[];
  specialized: DiscoveredProcessor[];
  complex: DiscoveredProcessor[];
}

export interface ValidatorsByCategory {
  primitive: DiscoveredValidator[];
  specialized: DiscoveredValidator[];
  complex: DiscoveredValidator[];
}

@Injectable()
export class FieldHandlerDiscoveryService {
  private readonly logger = new Logger(FieldHandlerDiscoveryService.name);

  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Discovers all field processors decorated with @FieldProcessor
   */
  discoverProcessors(): DiscoveredProcessor[] {
    const processors: DiscoveredProcessor[] = [];

    const providers = this.discoveryService.getProviders({
      metadataKey: FIELD_PROCESSOR_METADATA_KEY.toString(),
    });

    for (const provider of providers) {
      const metadata = this.extractProcessorMetadata(provider);
      if (metadata) {
        processors.push(metadata);
      }
    }

    this.logger.debug(`Discovered ${processors.length} field processors`);
    return processors;
  }

  /**
   * Discovers all field validators decorated with @FieldValidator
   */
  discoverValidators(): DiscoveredValidator[] {
    const validators: DiscoveredValidator[] = [];

    const providers = this.discoveryService.getProviders({
      metadataKey: FIELD_VALIDATOR_METADATA_KEY.toString(),
    });

    this.logger.debug(`Found ${providers.length} providers with validator metadata key`);

    for (const provider of providers) {
      this.logger.debug(`Processing provider: ${provider.metatype?.name}`);
      const metadata = this.extractValidatorMetadata(provider);
      if (metadata) {
        validators.push(metadata);
      }
    }

    this.logger.debug(`Discovered ${validators.length} field validators`);
    return validators;
  }

  /**
   * Groups discovered processors by category
   */
  getProcessorsByCategory(): ProcessorsByCategory {
    const processors = this.discoverProcessors();

    return {
      primitive: processors.filter((p) => p.metadata.category === 'primitive'),
      specialized: processors.filter((p) => p.metadata.category === 'specialized'),
      complex: processors.filter((p) => p.metadata.category === 'complex'),
    };
  }

  /**
   * Groups discovered validators by category
   */
  getValidatorsByCategory(): ValidatorsByCategory {
    const validators = this.discoverValidators();

    return {
      primitive: validators.filter((v) => v.metadata.category === 'primitive'),
      specialized: validators.filter((v) => v.metadata.category === 'specialized'),
      complex: validators.filter((v) => v.metadata.category === 'complex'),
    };
  }

  /**
   * Validates that a discovered processor has proper configuration
   */
  validateProcessorCompatibility(processor: DiscoveredProcessor): boolean {
    try {
      if (!processor.instance || !processor.metadata) {
        this.logger.warn(`Invalid processor configuration: ${processor.type.name}`);
        return false;
      }

      if (!processor.instance.supportedType || processor.instance.supportedType !== processor.metadata.type) {
        this.logger.warn(`Processor type mismatch: ${processor.type.name} - declared: ${processor.metadata.type}, actual: ${processor.instance.supportedType}`);
        return false;
      }

      if (
        typeof processor.instance.canProcess !== 'function' ||
        typeof processor.instance.generateValidationDecorators !== 'function' ||
        typeof processor.instance.generateTransformationDecorators !== 'function' ||
        typeof processor.instance.generateSerializationDecorators !== 'function'
      ) {
        this.logger.warn(`Processor missing required methods: ${processor.type.name}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error validating processor compatibility: ${processor.type.name}`, error);
      return false;
    }
  }

  /**
   * Validates that a discovered validator has proper configuration
   */
  validateValidatorCompatibility(validator: DiscoveredValidator): boolean {
    try {
      if (!validator.instance || !validator.metadata) {
        this.logger.warn(`Invalid validator configuration: ${validator.type.name}`);
        return false;
      }

      if (!validator.instance.supportedType || validator.instance.supportedType !== validator.metadata.type) {
        this.logger.warn(`Validator type mismatch: ${validator.type.name} - declared: ${validator.metadata.type}, actual: ${validator.instance.supportedType}`);
        return false;
      }

      if (typeof validator.instance.canValidate !== 'function' || typeof validator.instance.validate !== 'function') {
        this.logger.warn(`Validator missing required methods: ${validator.type.name}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error validating validator compatibility: ${validator.type.name}`, error);
      return false;
    }
  }

  private extractProcessorMetadata(wrapper: InstanceWrapper<BaseFieldValidator>): DiscoveredProcessor | null {
    try {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        return null;
      }

      const metadata = getFieldProcessorMetadata(metatype);
      if (!metadata) {
        return null;
      }

      // Ensure instance implements BaseFieldProcessor interface
      if (!(instance instanceof BaseFieldProcessor)) {
        this.logger.warn(`Processor ${metatype.name} does not extend BaseFieldProcessor`);
        return null;
      }

      return {
        instance,
        type: metatype as new (...args: unknown[]) => BaseFieldProcessor,
        metadata,
      };
    } catch (error) {
      this.logger.error('Failed to extract processor metadata', error);
      return null;
    }
  }

  private extractValidatorMetadata(wrapper: InstanceWrapper<BaseFieldValidator>): DiscoveredValidator | null {
    try {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        return null;
      }

      const metadata = getFieldValidatorMetadata(metatype);
      if (!metadata) {
        return null;
      }

      // Ensure instance implements BaseFieldValidator interface
      if (!(instance instanceof BaseFieldValidator)) {
        this.logger.warn(`Validator ${metatype.name} does not extend BaseFieldValidator`);
        return null;
      }

      return {
        instance,
        type: metatype as new (...args: unknown[]) => BaseFieldValidator,
        metadata,
      };
    } catch (error) {
      this.logger.error('Failed to extract validator metadata', error);
      return null;
    }
  }
}
