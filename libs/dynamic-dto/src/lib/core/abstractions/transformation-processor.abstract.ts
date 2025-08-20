import { Transform } from 'class-transformer';
import type { FieldSchema } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import type { AutoGenerateConfig } from '../interfaces/schema/primitive/string-field.schema';
import { AutoGenerationType } from '../interfaces/schema/primitive/string-field.schema';

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

export abstract class TransformationProcessor<T extends FieldSchema = FieldSchema> {
  abstract readonly supportedType: FieldTypeValue;

  abstract canProcess(schema: FieldSchema): schema is T;

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
        transform: ({ value, obj }) => {
          if (value !== undefined) return value;

          if (typeof schema.default === 'string' && schema.default.startsWith('${')) {
            return this.evaluateExpression(schema.default, obj);
          }

          return schema.default;
        },
        condition: (_, { value }) => value === undefined,
      });
    }

    return functions;
  }

  protected abstract getTypeSpecificTransformations(schema: T): TransformationFunction[];

  protected getSchemaSpecificTransformations(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    if ('transformationHooks' in schema && Array.isArray(schema.transformationHooks)) {
      schema.transformationHooks.forEach((hook, index) => {
        const transformationFunction: any = {
          order: 100 + index,
          name: `custom_hook_${index}`,
          transform: ({ value, obj }: any) => this.executeHook(hook.id, value, obj),
        };
        if (hook.condition) {
          transformationFunction.condition = (_: any, params: any) => this.evaluateCondition(hook.condition, params.obj);
        }
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

  protected generateAutoValue(type: AutoGenerationType, _config?: AutoGenerateConfig): unknown {
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

  protected evaluateExpression(expression: string, _context: Record<string, unknown>): unknown {
    return `EXPR:${expression}`;
  }

  protected executeHook(_hookId: string, value: unknown, _context: Record<string, unknown>): unknown {
    return value;
  }

  private evaluateCondition(condition: unknown, obj: Record<string, unknown>): boolean {
    return Boolean(condition && obj);
  }
}
