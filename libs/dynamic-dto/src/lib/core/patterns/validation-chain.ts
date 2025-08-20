import { Injectable, Logger } from '@nestjs/common';
import { ValidationStrategy } from '../abstractions/validation-strategy.abstract';
import type { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import type { ValidationContext, ValidationResult } from '../interfaces/validation';
import { ValidationResultMerger } from '../utils/validation-result-merger';
import { ValidationSeverity } from '../enums/validation.enums';

@Injectable()
export class ValidationChain {
  private readonly logger = new Logger(ValidationChain.name);
  private strategies: ValidationStrategy[] = [];

  addStrategy(strategy: ValidationStrategy): this {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.order - b.order);
    return this;
  }

  removeStrategy(strategyName: string): this {
    this.strategies = this.strategies.filter((s) => s.name !== strategyName);
    return this;
  }

  getStrategies(): readonly ValidationStrategy[] {
    return [...this.strategies];
  }

  execute(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    const results: ValidationResult[] = [];
    const executedStrategies: string[] = [];

    this.logger.debug(`Starting validation chain for schema: ${schema.name} with ${this.strategies.length} strategies`);

    for (const strategy of this.strategies) {
      try {
        if (strategy.canExecute(schema, context)) {
          this.logger.debug(`Executing strategy: ${strategy.name} (order: ${strategy.order})`);

          const result = strategy.execute(schema, context);
          results.push(result);
          executedStrategies.push(strategy.name);

          // Early termination on critical errors (optional)
          if (this.shouldStopOnCriticalError(result)) {
            this.logger.warn(`Critical error detected in strategy: ${strategy.name}. Stopping chain execution.`);
            break;
          }
        } else {
          this.logger.debug(`Skipping strategy: ${strategy.name} - conditions not met`);
        }
      } catch (error) {
        this.logger.error(`Strategy ${strategy.name} failed with error:`, error);

        // Create error result for failed strategy
        const errorResult: ValidationResult = {
          isValid: false,
          issues: [
            {
              message: `Strategy ${strategy.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              code: 'STRATEGY_EXECUTION_ERROR',
              severity: ValidationSeverity.error,
              fieldPath: schema.name,
              metadata: {
                strategy: strategy.name,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            },
          ],
          errors: [
            {
              message: `Strategy ${strategy.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              code: 'STRATEGY_EXECUTION_ERROR',
              severity: ValidationSeverity.error,
              fieldPath: schema.name,
              metadata: {
                strategy: strategy.name,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            },
          ],
          warnings: [],
          infos: [],
        };

        results.push(errorResult);
      }
    }

    const finalResult = ValidationResultMerger.mergeResults(results);

    this.logger.debug(`Validation chain completed for schema: ${schema.name}. ` + `Executed strategies: [${executedStrategies.join(', ')}]. Valid: ${finalResult.isValid}`);

    return finalResult;
  }

  private shouldStopOnCriticalError(result: ValidationResult): boolean {
    // Stop if there are any critical errors (you can customize this logic)
    return result.errors?.some((error) => error.code === 'VALIDATION_PIPELINE_ERROR' || error.code === 'STRATEGY_EXECUTION_ERROR') ?? false;
  }

  clear(): this {
    this.strategies = [];
    return this;
  }

  size(): number {
    return this.strategies.length;
  }
}
