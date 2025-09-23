export interface ValidationError {
  readonly field: string;
  readonly value: unknown;
  readonly message: string;
  readonly code: string;
  readonly context?: ValidationErrorContext | undefined;
}

export interface ValidationErrorContext {
  readonly fieldPath?: string;
  readonly constraint?: string;
  readonly expectedValue?: unknown;
  readonly actualValue?: unknown;
  readonly expectedType?: string;
  readonly actualType?: string;
  readonly schemaId?: string;
  readonly dtoName?: string;
  readonly parentPath?: string;
  readonly depth?: number;
  readonly timestamp?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ValidationErrorAggregated {
  readonly totalErrors: number;
  readonly errorsByField: Record<string, ValidationError[]>;
  readonly errorsByCode: Record<string, ValidationError[]>;
}

export type ValidationErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
