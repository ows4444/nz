import { Injectable } from '@nestjs/common';
import { StringBasicProcessor } from './string-basic.processor';
import { StringFormatProcessor } from './string-format.processor';
import { StringTransformationProcessor } from './string-transformation.processor';
import { StringAutoGenerationProcessor } from './string-auto-generation.processor';

/**
 * Factory for creating and managing string field processors.
 * Simplified factory pattern with cleaner interface and better maintainability.
 * Eliminates circular dependency risks through dependency injection composition.
 */
@Injectable()
export class StringProcessorFactory {
  constructor(
    private readonly basicProcessor: StringBasicProcessor,
    private readonly formatProcessor: StringFormatProcessor,
    private readonly transformationProcessor: StringTransformationProcessor,
    private readonly autoGenerationProcessor: StringAutoGenerationProcessor
  ) {}

  /**
   * Create string processor collection with lazy loading
   * This prevents circular dependency issues while maintaining access to all processors
   */
  createProcessorCollection() {
    return {
      getBasicProcessor: () => this.basicProcessor,
      getFormatProcessor: () => this.formatProcessor,
      getTransformationProcessor: () => this.transformationProcessor,
      getAutoGenerationProcessor: () => this.autoGenerationProcessor,
      getAllProcessors: () => [this.basicProcessor, this.formatProcessor, this.transformationProcessor, this.autoGenerationProcessor],
    };
  }

  /**
   * Validates that all processors are properly initialized
   */
  validateProcessors(): void {
    const processors = [
      { name: 'BasicProcessor', instance: this.basicProcessor },
      { name: 'FormatProcessor', instance: this.formatProcessor },
      {
        name: 'TransformationProcessor',
        instance: this.transformationProcessor,
      },
      {
        name: 'AutoGenerationProcessor',
        instance: this.autoGenerationProcessor,
      },
    ];

    for (const { name, instance } of processors) {
      if (!instance) {
        throw new Error(`StringProcessorFactory: ${name} is not properly initialized`);
      }
    }
  }
}
