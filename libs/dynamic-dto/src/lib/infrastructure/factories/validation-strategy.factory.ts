import { Injectable } from '@nestjs/common';
import { ValidationChain } from '../../core/patterns/validation-chain';
import { ValidationStrategy } from '../../core/abstractions/validation-strategy.abstract';
import { StructuralValidationStrategy } from '../../application/strategies/validation/structural-validation.strategy';
import { FieldValidationStrategy } from '../../application/strategies/validation/field-validation.strategy';
import { CrossFieldValidationStrategy } from '../../application/strategies/validation/cross-field-validation.strategy';

/**
 * Simplified validation strategy factory with consolidated strategies
 * Reduces complexity from 5 strategies to 3 focused strategies
 */
@Injectable()
export class ValidationStrategyFactory {
  constructor(
    private readonly structuralStrategy: StructuralValidationStrategy,
    private readonly fieldStrategy: FieldValidationStrategy,
    private readonly crossFieldStrategy: CrossFieldValidationStrategy
  ) {}

  createValidationChain(): ValidationChain {
    const chain = new ValidationChain();

    // Add strategies in order of execution
    chain.addStrategy(this.structuralStrategy).addStrategy(this.fieldStrategy).addStrategy(this.crossFieldStrategy);

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
      ['StructuralValidation', this.structuralStrategy],
      ['FieldValidation', this.fieldStrategy],
      ['CrossFieldValidation', this.crossFieldStrategy],
    ]);
  }

  getAllStrategies(): ValidationStrategy[] {
    return [this.structuralStrategy, this.fieldStrategy, this.crossFieldStrategy];
  }
}
