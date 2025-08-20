import { Injectable } from '@nestjs/common';
import { IFieldProcessingMediator } from '../interfaces/mediator/field-processing.mediator';
import type { FieldSchema } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import type { ValidationContext, ValidationResult } from '../interfaces/validation';
import type { ClassConstructor } from '../types/common.types';
import type { FieldProcessorRegistry } from '../../infrastructure/registries/field-processor.registry';
import type { NestedClassGeneratorService } from '../../infrastructure/services/nested-class-generator.service';
import type { FieldValidatorRegistry } from '../../infrastructure/registries/field-validator.registry';

@Injectable()
export class FieldProcessingMediator implements IFieldProcessingMediator {
  // These will be injected via setters to avoid circular dependencies
  private fieldProcessorRegistry?: FieldProcessorRegistry;
  private nestedClassGenerator?: NestedClassGeneratorService;
  private fieldValidatorRegistry?: FieldValidatorRegistry;

  setFieldProcessorRegistry(registry: FieldProcessorRegistry): void {
    this.fieldProcessorRegistry = registry;
  }

  setNestedClassGenerator(generator: NestedClassGeneratorService): void {
    this.nestedClassGenerator = generator;
  }

  setFieldValidatorRegistry(validator: FieldValidatorRegistry): void {
    this.fieldValidatorRegistry = validator;
  }

  processField(fieldSchema: FieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    if (!this.fieldProcessorRegistry) {
      throw new Error('FieldProcessorRegistry not initialized in mediator');
    }
    return this.fieldProcessorRegistry.processField(fieldSchema, isRequired, parentIsArray);
  }

  canProcessField(fieldType: FieldTypeValue): boolean {
    if (!this.fieldProcessorRegistry) {
      throw new Error('FieldProcessorRegistry not initialized in mediator');
    }
    return this.fieldProcessorRegistry.hasProcessor(fieldType);
  }

  getSupportedTypes(): FieldTypeValue[] {
    if (!this.fieldProcessorRegistry) {
      throw new Error('FieldProcessorRegistry not initialized in mediator');
    }
    return this.fieldProcessorRegistry.getSupportedTypes();
  }

  generateNestedClass(properties: Record<string, FieldSchema>, required?: string[], exclude?: boolean): ClassConstructor<object> {
    if (!this.nestedClassGenerator) {
      throw new Error('NestedClassGenerator not initialized in mediator');
    }
    return this.nestedClassGenerator.generateNestedClass(properties, required, exclude);
  }

  validateField(fieldSchema: FieldSchema, context?: ValidationContext): ValidationResult {
    if (!this.fieldValidatorRegistry) {
      throw new Error('FieldValidatorRegistry not initialized in mediator');
    }
    return this.fieldValidatorRegistry.validateField(fieldSchema, context!);
  }
}
