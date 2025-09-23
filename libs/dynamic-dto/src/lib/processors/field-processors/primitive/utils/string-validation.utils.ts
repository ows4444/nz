import type { ValidationOptions } from 'class-validator';
import { IsDefined, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Shared validation utilities for string field processors.
 * These utilities extract common patterns to reduce code duplication and
 * improve maintainability across string processors.
 */
export class StringValidationUtils {
  // Shared regex pattern cache for performance optimization
  private static readonly regexCache = new Map<string, RegExp>();
  private static readonly maxCacheSize = 1000;

  /**
   * Generate common validation decorators for string fields
   */
  static generateCommonValidationDecorators(isRequired: boolean, parentIsArray: boolean, nullable?: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const eachOption: ValidationOptions | undefined = parentIsArray ? { each: true } : undefined;

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined(eachOption));

      if (!nullable) {
        decorators.push(IsNotEmpty(eachOption));
      }
    } else {
      decorators.push(IsOptional(eachOption));
    }

    // Type validation
    decorators.push(IsString(eachOption));

    return decorators;
  }

  /**
   * Add length validation decorators to existing decorators array
   */
  static addLengthValidation(
    decorators: PropertyDecorator[],
    options: {
      minLength?: number;
      maxLength?: number;
      exactLength?: number;
    },
    eachOption?: ValidationOptions
  ): void {
    const { minLength, maxLength, exactLength } = options;

    if (exactLength !== undefined) {
      // Exact length takes precedence
      decorators.push(Length(exactLength, exactLength, eachOption));
    } else if (minLength !== undefined || maxLength !== undefined) {
      const min = minLength ?? 0;
      const max = maxLength ?? Number.MAX_SAFE_INTEGER;
      decorators.push(Length(min, max, eachOption));
    }
  }

  /**
   * Add pattern validation decorators to existing decorators array
   */
  static addPatternValidation(
    decorators: PropertyDecorator[],
    options: {
      pattern?: string | RegExp;
      antiPattern?: string | RegExp;
    },
    eachOption?: ValidationOptions
  ): void {
    const { pattern, antiPattern } = options;

    // Pattern validation
    if (pattern) {
      const regex = this.getCompiledRegex(pattern);
      decorators.push(Matches(regex, eachOption));
    }

    // Anti-pattern validation (what NOT to match)
    if (antiPattern) {
      const antiRegex = this.getCompiledRegex(antiPattern);
      decorators.push(
        Matches(antiRegex, {
          ...eachOption,
          message: 'Value matches forbidden pattern',
        })
      );
    }
  }

  /**
   * Get or create a compiled regex pattern with caching for performance
   */
  static getCompiledRegex(pattern: string | RegExp): RegExp {
    if (pattern instanceof RegExp) {
      return pattern;
    }

    // Cache compiled regex patterns for performance
    if (!this.regexCache.has(pattern)) {
      // Prevent cache from growing too large
      if (this.regexCache.size >= this.maxCacheSize) {
        this.clearRegexCache();
      }
      this.regexCache.set(pattern, new RegExp(pattern));
    }

    return this.regexCache.get(pattern)!;
  }

  /**
   * Clear the regex cache - can be called periodically or when memory pressure is detected
   */
  static clearRegexCache(): void {
    this.regexCache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats() {
    return {
      size: this.regexCache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.regexCache.keys()),
    };
  }
}
