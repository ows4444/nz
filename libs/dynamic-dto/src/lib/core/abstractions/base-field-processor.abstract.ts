import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { Exclude, Expose, Transform } from 'class-transformer';
import type { ConditionalValidation, FieldPermissions, FieldSchema, SerializableCondition } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import type { ValidatedFieldSchema } from '../interfaces/schema';
import { ValidationStrategy } from '../enums/validation.enums';
import type { AutoGenerateConfig } from '../interfaces/schema/primitive/string-field.schema';
import { AutoGenerationType } from '../interfaces/schema/primitive/string-field.schema';

export interface SerializationContext {
  userRoles?: string[];
  operation?: 'create' | 'read' | 'update' | 'delete';
  includeHidden?: boolean;
  includeDeprecated?: boolean;
  locale?: string;
  userId?: string;
}

export interface TransformationFunction {
  readonly order: number;
  readonly name: string;
  readonly transform: (params: TransformParams) => unknown;
  readonly condition?: (schema: FieldSchema, params: TransformParams) => boolean;
}

export interface TransformParams {
  value: unknown;
  obj: Record<string, unknown>;
  key: string;
}

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

  // ===== VALIDATION METHODS =====

  public generateEnhancedValidationDecorators(schema: T, isRequired: boolean): PropertyDecorator[] {
    const validatedSchema = this.validateSchemaStructure(schema);
    const decorators = [...this.generateValidationDecorators(validatedSchema, isRequired), ...this.generateConditionalValidationDecorators(validatedSchema)];

    if (schema.nullable) decorators.push(...this.createNullableValidation());
    if (isRequired && !schema.readonly) decorators.push(IsNotEmpty({ message: this.getValidationMessage(schema, 'required') }));
    else if (!isRequired) decorators.push(IsOptional());

    decorators.push(...this.generateValidationStrategyDecorators(schema));
    return decorators;
  }

  public generateConditionalValidationDecorators(schema: T): PropertyDecorator[] {
    if (!('conditionalValidation' in schema) || !schema.conditionalValidation) return [];
    return (schema.conditionalValidation as ConditionalValidation[]).map((condition) => this.createConditionalValidator(condition));
  }

  protected createNullableValidation(): PropertyDecorator[] {
    return [ValidateIf((_, val) => val !== null)];
  }

  protected generateValidationStrategyDecorators(schema: T): PropertyDecorator[] {
    if (!('validationStrategy' in schema)) return [];

    switch (schema.validationStrategy) {
      case ValidationStrategy.loose:
        return [IsOptional()];
      case ValidationStrategy.strict:
      case ValidationStrategy.transform:
      case ValidationStrategy.sanitize:
      default:
        return [];
    }
  }

  protected createConditionalValidator(condition: ConditionalValidation): PropertyDecorator {
    return ValidateIf((obj: Record<string, unknown>) => this.evaluateCondition(condition.condition, obj));
  }

  protected evaluateCondition(condition: SerializableCondition, obj: Record<string, unknown>): boolean {
    const value = this.getNestedValue(obj, condition.field);
    let result = this.evaluateSingleCondition(condition, value);

    if ('nested' in condition && condition.nested?.length) {
      const nestedResults = condition.nested.map((n) => this.evaluateCondition(n, obj));
      result = condition.logicalOperator === 'and' ? result && nestedResults.every(Boolean) : result || nestedResults.some(Boolean);
    }

    return result;
  }

  protected evaluateSingleCondition(condition: SerializableCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'exists':
        return value != null;
      case 'regex':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return true;
    }
  }

  protected getValidationMessage(schema: T, type: string): string {
    return `Field ${schema.type} validation failed for ${type}`;
  }

  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((val: unknown, key) => (val as Record<string, unknown>)?.[key], obj);
  }

  // ===== TRANSFORMATION METHODS =====

  public generateTransformationDecorators(schema: T): PropertyDecorator[] {
    const transformFunctions = this.collectTransformationFunctions(schema);

    if (transformFunctions.length === 0) {
      return [];
    }

    return [this.createUnifiedTransform(schema, transformFunctions)];
  }

  protected collectTransformationFunctions(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    functions.push(...this.getBaseTransformations(schema));
    functions.push(...this.getTypeSpecificTransformations(schema));
    functions.push(...this.getSchemaSpecificTransformations(schema));

    return functions.sort((a, b) => a.order - b.order);
  }

  protected getBaseTransformations(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    if (schema.readonly) {
      functions.push({
        order: 10,
        name: 'readonly',
        transform: ({ value, obj, key }) => obj?.[key] ?? value,
      });
    }

    if (schema.default !== undefined) {
      functions.push({
        order: 20,
        name: 'default_value',
        transform: ({ value }) => {
          if (value !== undefined) return value;

          if (typeof schema.default === 'string' && schema.default.startsWith('${')) {
            return this.evaluateExpression(schema.default);
          }

          return schema.default;
        },
        condition: (_, { value }) => value === undefined,
      });
    }

    return functions;
  }

  protected getSchemaSpecificTransformations(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    if ('transformationHooks' in schema && Array.isArray(schema.transformationHooks)) {
      schema.transformationHooks.forEach((hook, index) => {
        const transformationFunction: TransformationFunction = {
          order: 100 + index,
          name: `custom_hook_${index}`,
          transform: ({ value, obj }: TransformParams) => this.executeHook(hook.id, value),
          ...(hook.condition && {
            condition: (_: FieldSchema, params: TransformParams) => this.evaluateConditionForHook(hook.condition, params.obj),
          }),
        };
        functions.push(transformationFunction);
      });
    }

    return functions;
  }

  protected createUnifiedTransform(schema: T, transformFunctions: TransformationFunction[]): PropertyDecorator {
    return Transform(({ value, obj, key }: TransformParams) => {
      const params = { value, obj, key };
      let currentValue = value;

      for (const fn of transformFunctions) {
        try {
          if (fn.condition && !fn.condition(schema, { ...params, value: currentValue })) {
            continue;
          }

          const newValue = fn.transform({ ...params, value: currentValue });

          if (newValue !== undefined) {
            currentValue = newValue;
          }
        } catch (error) {
          console.warn(`Transformation '${fn.name}' failed:`, error);
        }
      }

      return currentValue;
    });
  }

  protected generateAutoValue(type: AutoGenerationType): unknown {
    const generators = {
      [AutoGenerationType.uuid]: 'AUTO_UUID',
      [AutoGenerationType.timestamp]: 'AUTO_TIMESTAMP',
      [AutoGenerationType.incremental]: 'AUTO_INCREMENTAL',
      [AutoGenerationType.slug]: 'AUTO_SLUG',
      [AutoGenerationType.hash]: 'AUTO_HASH',
      [AutoGenerationType.random_string]: 'AUTO_RANDOM_STRING',
      [AutoGenerationType.sequence]: 'AUTO_SEQUENCE',
    };
    return generators[type as keyof typeof generators];
  }

  protected evaluateExpression(expression: string): unknown {
    return `EXPR:${expression}`;
  }

  protected executeHook(_hookId: string, value: unknown): unknown {
    return value;
  }

  private evaluateConditionForHook(condition: unknown, obj: Record<string, unknown>): boolean {
    return Boolean(condition && obj);
  }

  // ===== SERIALIZATION METHODS =====

  public generateSerializationDecorators(schema: T, isRequired: boolean, excludeAll: boolean, context?: SerializationContext): PropertyDecorator[] {
    const validatedSchema = this.validateSchemaStructure(schema);

    if (this.shouldExcludeForPermissions(validatedSchema, context)) return [Exclude()];
    if (this.shouldExcludeForDeprecated(validatedSchema, context)) return [Exclude()];

    const decorators: PropertyDecorator[] = [];

    if ((excludeAll && schema.expose) || isRequired) decorators.push(Expose());
    if (!excludeAll && schema.exclude) decorators.push(Exclude());

    return decorators;
  }

  protected shouldExcludeForPermissions(schema: T, context?: SerializationContext): boolean {
    if (!context?.userRoles || !('permissions' in schema) || !schema.permissions) return false;
    return !this.checkOperationPermission(schema.permissions, context.userRoles, context.operation);
  }

  protected shouldExcludeForDeprecated(schema: T, context?: SerializationContext): boolean {
    return !!('deprecated' in schema && schema.deprecated) && !context?.includeDeprecated;
  }

  protected checkOperationPermission(permissions: FieldPermissions, userRoles: string[], operation?: 'create' | 'read' | 'update' | 'delete'): boolean {
    if (!userRoles?.length) return false;

    const roleMap = {
      create: permissions.create ?? permissions.write ?? [],
      read: permissions.read ?? [],
      update: permissions.update ?? permissions.write ?? [],
      delete: permissions.delete ?? permissions.write ?? [],
    };

    const requiredRoles = roleMap[operation ?? 'read'] ?? [];
    return this.checkPermission(requiredRoles, userRoles);
  }

  protected checkPermission(allowedRoles?: readonly string[], userRoles?: readonly string[]): boolean {
    if (!allowedRoles?.length) return true;
    return allowedRoles.some((role) => userRoles?.includes(role));
  }
}
