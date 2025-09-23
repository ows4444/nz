import type { ValidationSeverity, ValidationStrategy } from '../../../enums/validation.enums';
import type { DeepReadonly } from '../../../types/common.types';
import type { FieldTypeValue } from '../../../types/field.types';

export interface BaseFieldSchema {
  readonly type: FieldTypeValue;
  readonly id?: string;
  readonly name?: string;
  readonly title?: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly nullable?: boolean;
  readonly readonly?: boolean; // if readonly,  and autoGenerate is set, it will not be included in the DTO

  // Lifecycle
  readonly deprecated?: DeprecationInfo;
  readonly experimental?: boolean;

  // Validation
  readonly validationStrategy?: ValidationStrategy;
  readonly conditionalValidation?: readonly ConditionalValidation[];

  readonly expose?: boolean;
  readonly exclude?: boolean;

  // Access Control
  readonly permissions?: FieldPermissions;

  // Metadata
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
  readonly category?: string;
}

export interface DeprecationInfo {
  readonly since?: string;
  readonly reason?: string;
  readonly replacedBy?: string;
  readonly removeInVersion?: string;
  readonly migrationGuide?: string;
}

export interface ConditionalValidation {
  readonly condition: SerializableCondition;
  readonly validationRules: readonly ValidationRule[];
  readonly errorMessage?: string;
  readonly priority?: number;
}

export interface SerializableCondition {
  readonly field: string;
  readonly operator: ComparisonOperator;
  readonly value?: unknown;
  readonly logicalOperator?: LogicalOperator;
  readonly nested?: readonly SerializableCondition[];
}

export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'regex' | 'between';
export type LogicalOperator = 'and' | 'or' | 'not';

export interface ValidationRule {
  readonly type: string;
  readonly params?: DeepReadonly<Record<string, unknown>>;
  readonly message?: string;
  readonly severity?: ValidationSeverity;
}

export interface FieldPermissions {
  readonly read?: readonly string[];
  readonly write?: readonly string[];
  readonly create?: readonly string[];
  readonly update?: readonly string[];
  readonly delete?: readonly string[];
}
