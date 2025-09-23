import { Injectable } from '@nestjs/common';

/**
 * Custom validator function type
 */
export type CustomValidator = (value: unknown, config?: Record<string, unknown>) => boolean;

/**
 * Service responsible for managing custom validators used in union type conditions.
 * Extracted from the main processor to improve maintainability and testability.
 */
@Injectable()
export class UnionValidatorRegistry {
  private readonly validators = new Map<string, CustomValidator>();

  constructor() {
    // Register built-in validators
    this.registerBuiltInValidators();
  }

  /**
   * Registers a new custom validator
   * @param name The validator name
   * @param validator The validation function
   */
  registerValidator(name: string, validator: CustomValidator): void {
    this.validators.set(name, validator);
  }

  /**
   * Gets a registered validator by name
   * @param name The validator name
   * @returns The validator function or undefined
   */
  getValidator(name: string): CustomValidator | undefined {
    return this.validators.get(name);
  }

  /**
   * Gets all registered validator names
   * @returns Array of validator names
   */
  getRegisteredValidatorNames(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Checks if a validator is registered
   * @param name The validator name
   * @returns True if validator exists
   */
  hasValidator(name: string): boolean {
    return this.validators.has(name);
  }

  /**
   * Removes a validator from the registry
   * @param name The validator name
   * @returns True if validator was removed
   */
  removeValidator(name: string): boolean {
    return this.validators.delete(name);
  }

  /**
   * Clears all validators (except built-ins)
   */
  clearCustomValidators(): void {
    const builtInNames = this.getBuiltInValidatorNames();
    for (const [name] of this.validators) {
      if (!builtInNames.includes(name)) {
        this.validators.delete(name);
      }
    }
  }

  /**
   * Registers all built-in validators
   */
  private registerBuiltInValidators(): void {
    // Email validation
    this.validators.set('isEmail', (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

    // URL validation
    this.validators.set('isUrl', (value: unknown) => typeof value === 'string' && /^https?:\/\/.+/.test(value));

    // UUID validation
    this.validators.set('isUuid', (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

    // Length validation for strings and arrays
    this.validators.set('hasLength', (value: unknown, config?: Record<string, unknown>) => {
      if (typeof value === 'string' || Array.isArray(value)) {
        const { min = 0, max = Infinity } = config ?? {};
        return value.length >= (min as number) && value.length <= (max as number);
      }
      return false;
    });

    // Range validation for numbers
    this.validators.set('isInRange', (value: unknown, config?: Record<string, unknown>) => {
      if (typeof value === 'number') {
        const { min = -Infinity, max = Infinity } = config ?? {};
        return value >= (min as number) && value <= (max as number);
      }
      return false;
    });

    // Integer validation
    this.validators.set('isInteger', (value: unknown) => typeof value === 'number' && Number.isInteger(value));

    // Positive number validation
    this.validators.set('isPositive', (value: unknown) => typeof value === 'number' && value > 0);

    // Non-empty validation
    this.validators.set('isNotEmpty', (value: unknown) => {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 0;
      }
      return value !== null && value !== undefined;
    });

    // Date validation
    this.validators.set('isValidDate', (value: unknown) => {
      if (typeof value === 'string') {
        const date = new Date(value);
        return !isNaN(date.getTime());
      }
      return value instanceof Date && !isNaN(value.getTime());
    });

    // JSON validation
    this.validators.set('isValidJson', (value: unknown) => {
      if (typeof value !== 'string') return false;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    });

    // Phone number validation (basic)
    this.validators.set('isPhoneNumber', (value: unknown) => typeof value === 'string' && /^[+]? [1-9]\d{0,15}$/.test(value.replace(/[\s\-()]/g, '')));
  }

  /**
   * Gets the names of all built-in validators
   * @returns Array of built-in validator names
   */
  private getBuiltInValidatorNames(): string[] {
    return ['isEmail', 'isUrl', 'isUuid', 'hasLength', 'isInRange', 'isInteger', 'isPositive', 'isNotEmpty', 'isValidDate', 'isValidJson', 'isPhoneNumber'];
  }
}
