import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseFieldProcessor } from '../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { FieldTypeValue } from '../../core/types/field.types';

// Import processors
import { StringFieldProcessor } from '../../processors/field-processors/primitive/string-field.processor';
import { NumberFieldProcessor } from '../../processors/field-processors/primitive/number-field.processor';
import { BooleanFieldProcessor } from '../../processors/field-processors/primitive/boolean-field.processor';
import { DateFieldProcessor } from '../../processors/field-processors/specialized/date-field.processor';
import { ArrayFieldProcessor } from '../../processors/field-processors/complex/array-field.processor';
import { ObjectFieldProcessor } from '../../processors/field-processors/complex/object-field.processor';
import { EnumFieldProcessor } from '../../processors/field-processors/specialized/enum-field.processor';
import { UnionFieldProcessor } from '../../processors/field-processors/specialized/union-field.processor';

interface ProcessorStats {
  totalProcessors: number;
  supportedTypes: FieldTypeValue[];
  initialized: boolean;
  errorMetrics?: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    lastErrorTime?: Date;
  };
}

@Injectable()
export class FieldProcessorRegistry implements OnModuleInit {
  private readonly logger = new Logger(FieldProcessorRegistry.name);
  private readonly processors = new Map<FieldTypeValue, BaseFieldProcessor>();
  private initialized = false;

  // Performance monitoring for errors
  private readonly errorMetrics: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    lastErrorTime: Date | undefined;
  } = {
    totalErrors: 0,
    errorsByType: {},
    lastErrorTime: undefined,
  };

  constructor(
    private readonly stringProcessor: StringFieldProcessor,
    private readonly numberProcessor: NumberFieldProcessor,
    private readonly booleanProcessor: BooleanFieldProcessor,
    private readonly dateProcessor: DateFieldProcessor,
    private readonly arrayProcessor: ArrayFieldProcessor,
    private readonly objectProcessor: ObjectFieldProcessor,
    private readonly enumProcessor: EnumFieldProcessor,
    private readonly unionProcessor: UnionFieldProcessor
  ) {}

  onModuleInit(): void {
    if (this.initialized) return;

    try {
      // Register all processors
      this.registerProcessor(this.stringProcessor);
      this.registerProcessor(this.numberProcessor);
      this.registerProcessor(this.booleanProcessor);
      this.registerProcessor(this.dateProcessor);
      this.registerProcessor(this.arrayProcessor);
      this.registerProcessor(this.objectProcessor);
      this.registerProcessor(this.enumProcessor);
      this.registerProcessor(this.unionProcessor);

      this.initialized = true;
      this.logger.log(`Initialized ${this.processors.size} field processors`);
    } catch (error) {
      this.logger.error('Failed to initialize field processors', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  registerProcessor(processor: BaseFieldProcessor): void {
    if (!processor?.supportedType) {
      this.logger.warn('Invalid processor provided', { processor: processor?.constructor.name });
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
      // Track error for performance monitoring
      this.trackError('processor_not_found', type);

      // Log error with minimal overhead - only construct expensive array when needed
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
      // Track error for performance monitoring
      this.trackError('field_processing_failed', schema.type);

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process field for type: ${schema.type}`, { error: errorMessage });
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
      // Track error for performance monitoring
      this.trackError('field_separated_processing_failed', schema.type);

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
      supportedTypes: this.getSupportedTypes(), // Now uses cached version
      initialized: this.initialized,
      errorMetrics: {
        totalErrors: this.errorMetrics.totalErrors,
        errorsByType: { ...this.errorMetrics.errorsByType },
        ...(this.errorMetrics.lastErrorTime && { lastErrorTime: this.errorMetrics.lastErrorTime }),
      },
    };
  }

  /**
   * Track errors for performance monitoring
   * @private
   */
  private trackError(errorType: string, fieldType?: FieldTypeValue): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.lastErrorTime = new Date();

    const key = fieldType ? `${errorType}_${fieldType}` : errorType;
    this.errorMetrics.errorsByType[key] = (this.errorMetrics.errorsByType[key] || 0) + 1;

    // Log warning if error rate is high (more than 10 errors in recent activity)
    if (this.errorMetrics.totalErrors % 10 === 0) {
      this.logger.warn('High error rate detected in field processor registry', {
        totalErrors: this.errorMetrics.totalErrors,
        errorsByType: this.errorMetrics.errorsByType,
      });
    }
  }

  /**
   * Reset error metrics (useful for testing or periodic cleanup)
   */
  resetErrorMetrics(): void {
    this.errorMetrics.totalErrors = 0;
    this.errorMetrics.errorsByType = {};
    this.errorMetrics.lastErrorTime = undefined;
  }
}
