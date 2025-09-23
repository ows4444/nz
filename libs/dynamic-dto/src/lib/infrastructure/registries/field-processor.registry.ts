import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseFieldProcessor } from '../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { FieldTypeValue } from '../../core/types/field.types';
import { FieldProcessorDiscoveryService } from '../services/field-processor-discovery.service';

interface ProcessorStats {
  totalProcessors: number;
  supportedTypes: FieldTypeValue[];
  initialized: boolean;
}

@Injectable()
export class FieldProcessorRegistry implements OnModuleInit {
  private readonly logger = new Logger(FieldProcessorRegistry.name);
  private readonly processors = new Map<FieldTypeValue, BaseFieldProcessor>();
  private initialized = false;

  constructor(private readonly discoveryService: FieldProcessorDiscoveryService) {}

  onModuleInit(): void {
    if (this.initialized) return;

    try {
      // Auto-discover and register all field processors using reflection
      const discoveredProcessors = this.discoveryService.discoverProcessors();

      if (discoveredProcessors.length === 0) {
        this.logger.warn('No field processors discovered. Ensure processors are decorated with @FieldProcessor');
        return;
      }

      // Register discovered processors
      for (const discovered of discoveredProcessors) {
        if (this.discoveryService.validateProcessorCompatibility(discovered)) {
          this.registerProcessor(discovered.instance);
          this.logger.debug(`Auto-registered processor: ${discovered.type.name} for type: ${discovered.metadata.type}`);
        } else {
          this.logger.warn(`Skipping invalid processor: ${discovered.type.name}`);
        }
      }

      this.initialized = true;
      this.logger.log(`Auto-initialized ${this.processors.size} field processors using discovery service`);

      // Log processor categories for better debugging
      const categories = this.discoveryService.getProcessorsByCategory();
      for (const [category, processors] of Object.entries(categories)) {
        if (processors.length > 0) {
          this.logger.debug(`${category} processors: ${processors.map((p) => p.type.name).join(', ')}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize field processors', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

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

  hasProcessor(type: FieldTypeValue): boolean {
    return this.processors.has(type);
  }

  getAllProcessors(): BaseFieldProcessor[] {
    return Array.from(this.processors.values());
  }

  private _supportedTypesCache: FieldTypeValue[] | null = null;

  getSupportedTypes(): FieldTypeValue[] {
    // Cache supported types since processors rarely change after initialization
    this._supportedTypesCache ??= Array.from(this.processors.keys());
    return this._supportedTypesCache;
  }

  getProcessorStats(): ProcessorStats {
    return {
      totalProcessors: this.processors.size,
      supportedTypes: this.getSupportedTypes(),
      initialized: this.initialized,
    };
  }
}
