import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FieldProcessingMediator } from '../../core/mediators/field-processing.mediator';
import { FieldProcessorRegistry } from '../registries/field-processor.registry';
import { FieldValidatorRegistry } from '../registries/field-validator.registry';
import { NestedClassGeneratorService } from '../services/nested-class-generator.service';
import { ArrayFieldProcessor } from '../../processors/field-processors/complex/array-field.processor';

@Injectable()
export class DependencyResolverService implements OnModuleInit {
  private readonly logger = new Logger(DependencyResolverService.name);

  constructor(
    private readonly mediator: FieldProcessingMediator,
    private readonly fieldProcessorRegistry: FieldProcessorRegistry,
    private readonly fieldValidatorRegistry: FieldValidatorRegistry,
    private readonly nestedClassGenerator: NestedClassGeneratorService,
    private readonly arrayFieldProcessor: ArrayFieldProcessor
  ) {}

  onModuleInit(): void {
    this.logger.debug('Resolving circular dependencies with mediator pattern');

    try {
      // Wire up the mediator with all the required services
      this.mediator.setFieldProcessorRegistry(this.fieldProcessorRegistry);
      this.mediator.setFieldValidatorRegistry(this.fieldValidatorRegistry);
      this.mediator.setNestedClassGenerator(this.nestedClassGenerator);

      // Set the mediator on services that need it
      this.nestedClassGenerator.setProcessingMediator(this.mediator);
      this.arrayFieldProcessor.setProcessingMediator(this.mediator);

      this.logger.log('Successfully resolved circular dependencies using mediator pattern');
    } catch (error) {
      this.logger.error('Failed to resolve dependencies', error);
      throw error;
    }
  }
}
