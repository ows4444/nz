import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import type { FieldSchema } from '../interfaces/schema';

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

export interface FieldTransformationService {
  generateTransformationDecorators(schema: FieldSchema): PropertyDecorator[];
  collectTransformationFunctions(schema: FieldSchema): TransformationFunction[];
}

@Injectable()
export class DefaultFieldTransformationService implements FieldTransformationService {
  generateTransformationDecorators(schema: FieldSchema): PropertyDecorator[] {
    const transformFunctions = this.collectTransformationFunctions(schema);

    if (transformFunctions.length === 0) {
      return [];
    }

    return [this.createUnifiedTransform(schema, transformFunctions)];
  }

  collectTransformationFunctions(schema: FieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Get type-specific transformations (to be implemented by concrete processors)
    // This is a simplified version - actual implementation would delegate to specific processors

    // Handle transformation hooks if present
    if ('transformationHooks' in schema && Array.isArray(schema.transformationHooks)) {
      schema.transformationHooks.forEach((hook, index) => {
        const transformationFunction: TransformationFunction = {
          order: 100 + index,
          name: `custom_hook_${index}`,
          transform: ({ value }: TransformParams) => this.executeHook(hook, value),
          ...(hook.condition && {
            condition: (_: FieldSchema, params: TransformParams) => this.evaluateConditionForHook(hook.condition, params.obj),
          }),
        };
        functions.push(transformationFunction);
      });
    }

    return functions;
  }

  private createUnifiedTransform(schema: FieldSchema, transformFunctions: TransformationFunction[]): PropertyDecorator {
    return Transform(({ value, obj, key }) => {
      const params = { value, obj, key };
      let currentValue = value;

      // Sort by order and execute
      const sortedFunctions = transformFunctions.sort((a, b) => a.order - b.order);

      for (const fn of sortedFunctions) {
        try {
          // Check condition if present
          if (fn.condition && !fn.condition(schema, { ...params, value: currentValue })) {
            continue;
          }

          const newValue = fn.transform({ ...params, value: currentValue });

          if (newValue !== undefined) {
            currentValue = newValue;
          }
        } catch (error) {
          // Instead of silently logging, propagate transformation errors
          const errorMessage = `Transformation '${fn.name}' failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
      }

      return currentValue;
    });
  }

  private executeHook(hook: unknown, value: unknown): unknown {
    // Handle function hooks with proper error handling
    if (typeof hook === 'function') {
      try {
        const result = hook(value);
        return result !== undefined ? result : value;
      } catch (error) {
        // Log the error and propagate it instead of silently failing
        const errorMessage = `Hook execution failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
    }

    // Handle object hooks with transform method
    if (hook && typeof hook === 'object' && 'transform' in hook) {
      const hookObj = hook as { transform: unknown; name?: string };
      if (typeof hookObj.transform === 'function') {
        try {
          const result = hookObj.transform(value);
          return result !== undefined ? result : value;
        } catch (error) {
          const hookName = hookObj.name || 'unnamed';
          const errorMessage = `Hook '${hookName}' execution failed: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
      }
    }

    // Handle async hooks (promises)
    if (hook && typeof hook === 'object' && 'then' in hook) {
      // For now, we don't support async hooks in synchronous transformation
      // This should be handled at a higher level
      console.warn('Async hooks are not supported in synchronous transformation pipeline');
      return value;
    }

    // If hook is not a valid transformation, log warning and return original value
    if (hook != null) {
      console.warn('Invalid hook type provided:', typeof hook, 'Expected function or object with transform method');
    }

    return value;
  }

  private evaluateConditionForHook(condition: unknown, obj: Record<string, unknown>): boolean {
    // Simplified condition evaluation
    if (typeof condition === 'function') {
      return condition(obj);
    }
    return true;
  }
}
