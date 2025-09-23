import { Injectable, Logger, Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { BaseFieldProcessor } from '../../core/abstractions/base-field-processor.abstract';
import { FIELD_PROCESSOR_METADATA_KEY, FieldProcessorMetadata } from '../../core/decorators/field-processor.decorator';
import type { FieldTypeValue } from '../../core/types/field.types';

export interface DiscoveredProcessor {
  instance: BaseFieldProcessor;
  metadata: FieldProcessorMetadata;
  type: Type<BaseFieldProcessor>;
}

@Injectable()
export class FieldProcessorDiscoveryService {
  private readonly logger = new Logger(FieldProcessorDiscoveryService.name);

  constructor(private readonly discoveryService: DiscoveryService, private readonly reflector: Reflector) {}

  /**
   * Discovers all field processors that have been decorated with @FieldProcessor
   * Uses NestJS DiscoveryService for efficient module scanning
   */
  discoverProcessors(): DiscoveredProcessor[] {
    const processors: DiscoveredProcessor[] = [];

    try {
      // Find all providers with field processor metadata
      const providers = this.discoveryService.getProviders();

      for (const wrapper of providers) {
        if (!wrapper.metatype || !wrapper.instance) {
          continue;
        }

        // Check if the provider has field processor metadata
        const metadata = this.reflector.get<FieldProcessorMetadata>(FIELD_PROCESSOR_METADATA_KEY, wrapper.metatype);

        if (metadata && this.isFieldProcessorInstance(wrapper.instance)) {
          processors.push({
            instance: wrapper.instance,
            metadata,
            type: wrapper.metatype as Type<BaseFieldProcessor>,
          });

          this.logger.debug(`Discovered field processor: ${wrapper.metatype.name} for type: ${metadata.type}`);
        }
      }

      // Sort processors by priority (higher priority first)
      processors.sort((a, b) => (b.metadata.priority ?? 0) - (a.metadata.priority ?? 0));

      this.logger.log(`Discovered ${processors.length} field processors`);
    } catch (error) {
      this.logger.error('Failed to discover field processors', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Field processor discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return processors;
  }

  /**
   * Gets processors grouped by category
   */
  getProcessorsByCategory(): Record<string, DiscoveredProcessor[]> {
    const processors = this.discoverProcessors();
    const grouped: Record<string, DiscoveredProcessor[]> = {
      primitive: [],
      specialized: [],
      complex: [],
      other: [],
    };

    for (const processor of processors) {
      const category = processor.metadata.category ?? 'other';
      grouped[category] ??= [];
      grouped[category].push(processor);
    }

    return grouped;
  }

  /**
   * Gets all supported field types from discovered processors
   */
  getSupportedTypes(): FieldTypeValue[] {
    return this.discoverProcessors().map((p) => p.metadata.type);
  }

  /**
   * Validates that a discovered processor can handle its declared type
   */
  validateProcessorCompatibility(processor: DiscoveredProcessor): boolean {
    try {
      // Check if the processor's supportedType matches the metadata
      if (processor.instance.supportedType !== processor.metadata.type) {
        this.logger.warn(`Processor type mismatch: ${processor.type.name} declares ${processor.metadata.type} ` + `but supportedType is ${processor.instance.supportedType}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Processor validation failed for ${processor.type.name}`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Type guard to check if an instance is a BaseFieldProcessor
   */
  private isFieldProcessorInstance(instance: any): instance is BaseFieldProcessor {
    if (!instance || typeof instance !== 'object') {
      return false;
    }

    return (
      'supportedType' in instance &&
      'canProcess' in instance &&
      typeof instance.canProcess === 'function' &&
      'generateValidationDecorators' in instance &&
      typeof instance.generateValidationDecorators === 'function'
    );
  }
}
