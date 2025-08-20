import { Injectable } from '@nestjs/common';
import { ValidationChain } from '../../core/patterns/validation-chain';
import { ValidationStrategy } from '../../core/abstractions/validation-strategy.abstract';
import { EnhancedSchemaValidationStrategy } from '../../application/strategies/validation/enhanced-schema-validation.strategy';
import { BaseSchemaValidationStrategy } from '../../application/strategies/validation/base-schema-validation.strategy';
import { FieldRegistryValidationStrategy } from '../../application/strategies/validation/field-registry-validation.strategy';
import { BusinessRulesValidationStrategy } from '../../application/strategies/validation/business-rules-validation.strategy';
import { CrossFieldValidationStrategy } from '../../application/strategies/validation/cross-field-validation.strategy';

@Injectable()
export class ValidationStrategyFactory {
  constructor(
    private readonly enhancedSchemaStrategy: EnhancedSchemaValidationStrategy,
    private readonly baseSchemaStrategy: BaseSchemaValidationStrategy,
    private readonly fieldRegistryStrategy: FieldRegistryValidationStrategy,
    private readonly businessRulesStrategy: BusinessRulesValidationStrategy,
    private readonly crossFieldStrategy: CrossFieldValidationStrategy
  ) {}

  createValidationChain(): ValidationChain {
    const chain = new ValidationChain();

    // Add strategies in order of execution
    chain
      .addStrategy(this.enhancedSchemaStrategy)
      .addStrategy(this.baseSchemaStrategy)
      .addStrategy(this.fieldRegistryStrategy)
      .addStrategy(this.businessRulesStrategy)
      .addStrategy(this.crossFieldStrategy);

    return chain;
  }

  createCustomValidationChain(strategies: string[]): ValidationChain {
    const chain = new ValidationChain();
    const strategyMap = this.getStrategyMap();

    for (const strategyName of strategies) {
      const strategy = strategyMap.get(strategyName);
      if (strategy) {
        chain.addStrategy(strategy);
      }
    }

    return chain;
  }

  private getStrategyMap(): Map<string, ValidationStrategy> {
    return new Map<string, ValidationStrategy>([
      ['EnhancedSchemaValidation', this.enhancedSchemaStrategy],
      ['BaseSchemaValidation', this.baseSchemaStrategy],
      ['FieldRegistryValidation', this.fieldRegistryStrategy],
      ['BusinessRulesValidation', this.businessRulesStrategy],
      ['CrossFieldValidation', this.crossFieldStrategy],
    ]);
  }

  getAllStrategies(): ValidationStrategy[] {
    return [this.enhancedSchemaStrategy, this.baseSchemaStrategy, this.fieldRegistryStrategy, this.businessRulesStrategy, this.crossFieldStrategy];
  }
}
