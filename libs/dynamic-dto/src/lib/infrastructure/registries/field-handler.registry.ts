import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseFieldProcessor } from '../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { FieldTypeValue } from '../../core/types/field.types';
import { FieldProcessorDiscoveryService } from '../services/field-processor-discovery.service';
import { FieldValidatorRegistry } from './field-validator.registry';

export interface ValidatorStats {
  totalValidators: number;
  validatorsByCategory: Record<string, string[]>;
  supportedTypes: FieldTypeValue[];
}

interface ProcessorRegistryStats {
  totalProcessors: number;
  supportedTypes: FieldTypeValue[];
  processorsByCategory: Record<string, string[]>;
  initialized: boolean;
}

/**
 * Registry for field processors with delegation to separate validator registry
 * Simplified architecture with clear separation of concerns
 */
@Injectable()
export class FieldHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(FieldHandlerRegistry.name);
  private readonly processors = new Map<FieldTypeValue, BaseFieldProcessor>();
  private initialized = false;
  private _supportedTypesCache: FieldTypeValue[] | null = null;

  constructor(private readonly discoveryService: FieldProcessorDiscoveryService, private readonly validatorRegistry: FieldValidatorRegistry) {}

  onModuleInit(): void {
    if (this.initialized) return;

    try {
      this.initializeProcessors();
      this.initialized = true;
      this.logger.log(`Initialized field handler registry with ${this.processors.size} processors`);
    } catch (error) {
      this.logger.error('Failed to initialize field handlers', error);
      throw error;
    }
  }

  private initializeProcessors(): void {
    // Auto-discover and register all field processors using reflection
    const discoveredProcessors = this.discoveryService.discoverProcessors();

    if (discoveredProcessors.length === 0) {
      this.logger.warn('No field processors discovered. Ensure processors are decorated with @FieldProcessor');
      return;
    }

    // Register discovered processors
    for (const discovered of discoveredProcessors) {
      if (this.discoveryService.validateProcessorCompatibility(discovered)) {
        this.processors.set(discovered.instance.supportedType, discovered.instance);
        this.logger.debug(`Auto-registered processor: ${discovered.type.name} for type: ${discovered.metadata.type}`);
      } else {
        this.logger.warn(`Skipping invalid processor: ${discovered.type.name}`);
      }
    }

    // Log processor categories for better debugging
    const categories = this.discoveryService.getProcessorsByCategory();
    for (const [category, processors] of Object.entries(categories)) {
      if (processors.length > 0) {
        this.logger.debug(`${category} processors: ${processors.map((p) => p.type.name).join(', ')}`);
      }
    }
  }

  // Processor management methods
  registerProcessor(processor: BaseFieldProcessor): void {
    if (!processor?.supportedType) {
      this.logger.warn('Invalid processor provided', {
        processor: processor?.constructor.name,
      });
      return;
    }

    const existingProcessor = this.processors.get(processor.supportedType);
    if (existingProcessor) {
      this.logger.warn(`Processor for type ${processor.supportedType} already exists, overriding`, {
        existing: existingProcessor.constructor.name,
        new: processor.constructor.name,
      });
    }

    this.processors.set(processor.supportedType, processor);
    // Invalidate cache when processors change
    this._supportedTypesCache = null;
    this.logger.debug(`Registered processor for type: ${processor.supportedType}`);
  }

  getProcessor(type: FieldTypeValue): BaseFieldProcessor {
    const processor = this.processors.get(type);
    if (!processor) {
      this.logger.error(`No processor found for field type: ${type}`);
      throw new Error(`No processor found for field type: ${type}`);
    }
    return processor;
  }

  hasProcessor(type: FieldTypeValue): boolean {
    return this.processors.has(type);
  }

  // Validator methods (delegated to validator registry)
  getValidator(type: FieldTypeValue) {
    return this.validatorRegistry.getValidator(type);
  }

  hasValidator(type: FieldTypeValue): boolean {
    return this.validatorRegistry.hasValidator(type);
  }

  // Field processing methods
  processField(schema: FieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    try {
      const processor = this.getProcessor(schema.type);

      if (!processor.canProcess(schema)) {
        throw new Error(`Processor ${processor.constructor.name} cannot handle schema for type: ${(schema as { type: string }).type}`);
      }

      return [
        ...processor.generateValidationDecorators(schema, isRequired, parentIsArray),
        ...processor.generateTransformationDecorators(schema),
        ...processor.generateSerializationDecorators(schema, isRequired, false),
      ];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process field for type: ${schema.type}`, {
        error: errorMessage,
      });
      throw new Error(`Field processing failed for type ${schema.type}: ${errorMessage}`);
    }
  }

  processFieldSeparated(
    schema: FieldSchema,
    isRequired: boolean
  ): {
    validationDecorators: PropertyDecorator[];
    transformationDecorators: PropertyDecorator[];
    serializationDecorators: PropertyDecorator[];
  } {
    try {
      const processor = this.getProcessor(schema.type);

      if (!processor.canProcess(schema)) {
        throw new Error(`Processor ${processor.constructor.name} cannot handle schema for type: ${(schema as { type: string }).type}`);
      }

      return {
        validationDecorators: processor.generateValidationDecorators(schema, isRequired),
        transformationDecorators: processor.generateTransformationDecorators(schema),
        serializationDecorators: processor.generateSerializationDecorators(schema, isRequired, false),
      };
    } catch (error) {
      this.logger.error('Failed to process field', {
        fieldType: schema.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Field validation methods (delegated)
  validateField(schema: FieldSchema, context: ValidationContext): ValidationResult {
    return this.validatorRegistry.validateField(schema, context);
  }

  // Utility methods
  getAllProcessors(): BaseFieldProcessor[] {
    return Array.from(this.processors.values());
  }

  getAllValidators() {
    return this.validatorRegistry.getAllValidators();
  }

  getSupportedTypes(): FieldTypeValue[] {
    // Cache supported types since processors rarely change after initialization
    if (!this._supportedTypesCache) {
      const processorTypes = Array.from(this.processors.keys());
      const validatorTypes = this.validatorRegistry.getSupportedTypes();
      const allTypes = new Set([...processorTypes, ...validatorTypes]);
      this._supportedTypesCache = Array.from(allTypes);
    }
    return this._supportedTypesCache;
  }

  unregisterProcessor(type: FieldTypeValue): boolean {
    const removed = this.processors.delete(type);
    if (removed) {
      this._supportedTypesCache = null; // Invalidate cache
      this.logger.debug(`Unregistered processor for type: ${type}`);
    }
    return removed;
  }

  getHandlerStats(): ProcessorRegistryStats {
    const processorsByCategory = this.discoveryService.getProcessorsByCategory();
    const categoriesMap: Record<string, string[]> = {};

    for (const [category, processors] of Object.entries(processorsByCategory)) {
      categoriesMap[category] = processors.map((p) => p.type.name);
    }

    return {
      totalProcessors: this.processors.size,
      supportedTypes: this.getSupportedTypes(),
      processorsByCategory: categoriesMap,
      initialized: this.initialized,
    };
  }

  getValidatorStats(): ValidatorStats {
    return this.validatorRegistry.getStats();
  }
}
