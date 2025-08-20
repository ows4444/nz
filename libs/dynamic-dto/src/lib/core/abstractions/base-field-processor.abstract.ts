import { ValidationDecorator } from './validation-decorator.abstract';
import { type TransformationFunction, TransformationProcessor } from './transformation-processor.abstract';
import { type SerializationContext, SerializationProcessor } from './serialization-processor.abstract';
import type { FieldSchema } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import type { ValidatedFieldSchema } from '../interfaces/schema';

export abstract class BaseFieldProcessor<T extends FieldSchema = FieldSchema> {
  abstract readonly supportedType: FieldTypeValue;
  abstract canProcess(schema: FieldSchema): schema is T;
  abstract generateValidationDecorators(schema: T, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[];
  abstract getTypeSpecificTransformations(schema: T): TransformationFunction[];

  /**
   * Type-safe schema validation that ensures schema conforms to expected structure
   */
  validateSchemaStructure(schema: T): ValidatedFieldSchema<T> {
    if (!schema.type || typeof schema.type !== 'string') {
      throw new Error(`Invalid schema: missing or invalid type property`);
    }

    if (schema.type !== this.supportedType) {
      throw new Error(`Schema type mismatch: expected ${this.supportedType}, got ${schema.type}`);
    }

    return schema as ValidatedFieldSchema<T>;
  }

  /**
   * Generic constraint helper for ensuring proper typing
   */
  protected ensureType<U extends T>(schema: T, typeGuard: (schema: T) => schema is U): U {
    if (!typeGuard(schema)) {
      throw new Error(`Schema does not match expected type constraints`);
    }
    return schema;
  }

  private readonly validator: ValidationDecorator<T>;
  private readonly transformer: TransformationProcessor<T>;
  private readonly serializer: SerializationProcessor<T>;

  constructor() {
    this.validator = new ValidatorImpl(this);
    this.transformer = new TransformerImpl(this);
    this.serializer = new SerializerImpl(this);
  }

  public generateTransformationDecorators(schema: T): PropertyDecorator[] {
    return this.transformer.generateTransformationDecorators(schema);
  }

  public generateSerializationDecorators(schema: T, isRequired: boolean, excludeAll: boolean, context?: SerializationContext): PropertyDecorator[] {
    return this.serializer.generateSerializationDecorators(schema, isRequired, excludeAll, context);
  }

  public generateEnhancedValidationDecorators(schema: T, isRequired: boolean): PropertyDecorator[] {
    return this.validator.generateEnhancedValidationDecorators(schema, isRequired);
  }

  public generateConditionalValidationDecorators(schema: T): PropertyDecorator[] {
    return this.validator.generateConditionalValidationDecorators(schema);
  }
}

class ValidatorImpl<T extends FieldSchema> extends ValidationDecorator<T> {
  readonly supportedType: FieldTypeValue;

  constructor(private readonly parent: BaseFieldProcessor<T>) {
    super();
    this.supportedType = parent.supportedType;
  }

  canProcess(schema: FieldSchema): schema is T {
    return this.parent.canProcess(schema);
  }

  generateValidationDecorators(schema: T, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    // Validate schema structure before processing
    const validatedSchema = this.parent.validateSchemaStructure(schema);
    return this.parent.generateValidationDecorators(validatedSchema, isRequired, parentIsArray);
  }
}

class TransformerImpl<T extends FieldSchema> extends TransformationProcessor<T> {
  readonly supportedType: FieldTypeValue;

  constructor(private readonly parent: BaseFieldProcessor<T>) {
    super();
    this.supportedType = parent.supportedType;
  }

  canProcess(schema: FieldSchema): schema is T {
    return this.parent.canProcess(schema);
  }

  getTypeSpecificTransformations(schema: T): TransformationFunction[] {
    // Ensure type safety before processing transformations
    const validatedSchema = this.parent.validateSchemaStructure(schema);
    return this.parent.getTypeSpecificTransformations(validatedSchema);
  }
}

class SerializerImpl<T extends FieldSchema> extends SerializationProcessor<T> {
  readonly supportedType: FieldTypeValue;

  constructor(private readonly parent: BaseFieldProcessor<T>) {
    super();
    this.supportedType = parent.supportedType;
  }

  canProcess(schema: FieldSchema): schema is T {
    return this.parent.canProcess(schema);
  }

  /**
   * Override to include schema validation
   */
  override generateSerializationDecorators(schema: T, isRequired: boolean, excludeAll: boolean, context?: SerializationContext): PropertyDecorator[] {
    const validatedSchema = this.parent.validateSchemaStructure(schema);
    return super.generateSerializationDecorators(validatedSchema, isRequired, excludeAll, context);
  }
}
