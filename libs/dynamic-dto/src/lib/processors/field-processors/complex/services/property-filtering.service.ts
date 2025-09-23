import { Injectable } from '@nestjs/common';
import type { ObjectFieldSchema } from '../../../../core/interfaces/schema/complex/object-field.schema';
import type { FieldPermissions } from '../../../../core/interfaces/schema/base/base-field.schema';
import type { ValidationStrategy } from '../../../../core/enums/validation.enums';

export interface PropertyTransformationRule {
  readonly field: string;
  readonly transformationType: 'rename' | 'normalize' | 'format' | 'compute' | 'mask';
  readonly options?: {
    readonly newName?: string;
    readonly normalizeFormat?: 'lowercase' | 'uppercase' | 'trim' | 'slug';
    readonly dateFormat?: string;
    readonly numberFormat?: { precision?: number; scale?: number };
    readonly computeExpression?: string;
    readonly maskPattern?: string;
  };
  readonly condition?: (value: unknown, object: Record<string, unknown>) => boolean;
}

export interface SecurityContext {
  readonly userRoles: readonly string[];
  readonly permissions: readonly string[];
  readonly userId?: string;
  readonly accessLevel?: 'read' | 'write' | 'admin';
}

@Injectable()
export class PropertyFilteringService {
  filterPropertiesByPermissions(value: Record<string, unknown>, schema: ObjectFieldSchema, context?: SecurityContext): Record<string, unknown> {
    if (!context || !schema.properties) {
      return value;
    }

    const filtered: Record<string, unknown> = {};
    const userRoles = new Set(context.userRoles);
    const userPermissions = new Set(context.permissions);

    for (const [key, val] of Object.entries(value)) {
      const fieldSchema = schema.properties[key];
      if (!fieldSchema) {
        continue; // Field not in schema
      }

      const fieldPermissions = fieldSchema.permissions;
      if (!fieldPermissions) {
        // No permissions defined - allow access
        filtered[key] = val;
        continue;
      }

      // Check read permissions
      if (this.hasReadPermission(fieldPermissions, userRoles, userPermissions, context)) {
        // Apply masking for sensitive fields if needed
        filtered[key] = this.applyPermissionBasedMasking(val, fieldSchema.permissions, context);
      }
    }

    return filtered;
  }

  private hasReadPermission(fieldPermissions: FieldPermissions, userRoles: Set<string>, userPermissions: Set<string>, context: SecurityContext): boolean {
    // If no read permissions defined, allow access
    if (!fieldPermissions.read || fieldPermissions.read.length === 0) {
      return true;
    }

    // Check if user has required roles
    const hasRequiredRole = fieldPermissions.read.some((role) => userRoles.has(role));
    if (hasRequiredRole) {
      return true;
    }

    // Check if user has required permissions
    const hasRequiredPermission = fieldPermissions.read.some((perm) => userPermissions.has(perm));
    if (hasRequiredPermission) {
      return true;
    }

    // Special access level checks
    if (context.accessLevel === 'admin') {
      return true;
    }

    return false;
  }

  private applyPermissionBasedMasking(value: unknown, permissions: FieldPermissions | undefined, context: SecurityContext): unknown {
    if (!permissions || context.accessLevel === 'admin') {
      return value;
    }

    // Apply masking for sensitive data based on access level
    if (typeof value === 'string') {
      // Mask email addresses for lower privilege users
      if (value.includes('@') && !context.userRoles.includes('data_analyst')) {
        const [username, domain] = value.split('@');
        if (username && domain) {
          const maskedUsername = username.slice(0, 2) + '*'.repeat(Math.max(username.length - 2, 1));
          return `${maskedUsername}@${domain}`;
        }
      }

      // Mask phone numbers
      if (/^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s-()]/g, '')) && !context.userRoles.includes('contact_viewer')) {
        return value.slice(0, -4).replace(/\d/g, '*') + value.slice(-4);
      }
    }

    return value;
  }

  removeAdditionalProperties(value: Record<string, unknown>, schema: ObjectFieldSchema): Record<string, unknown> {
    if (!schema.properties) {
      return value;
    }

    const allowedKeys = new Set(Object.keys(schema.properties));
    const filtered: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (allowedKeys.has(key)) {
        filtered[key] = val;
      }
    }

    return filtered;
  }

  transformObjectProperties(
    value: Record<string, unknown>,
    schema: ObjectFieldSchema,
    transformationRules?: readonly PropertyTransformationRule[],
    validationStrategy?: ValidationStrategy
  ): Record<string, unknown> {
    if (!transformationRules || transformationRules.length === 0) {
      return this.applyBasicTransformations(value, schema, validationStrategy);
    }

    let transformed = { ...value };

    // Apply custom transformation rules
    for (const rule of transformationRules) {
      if (rule.condition && !rule.condition(transformed[rule.field], transformed)) {
        continue;
      }

      transformed = this.applyTransformationRule(transformed, rule);
    }

    // Apply schema-based transformations
    return this.applyBasicTransformations(transformed, schema, validationStrategy);
  }

  private applyBasicTransformations(value: Record<string, unknown>, schema: ObjectFieldSchema, validationStrategy?: ValidationStrategy): Record<string, unknown> {
    if (!schema.properties) {
      return value;
    }

    const transformed: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      const fieldSchema = schema.properties[key];
      if (!fieldSchema) {
        // Handle additional properties based on schema settings
        if (schema.additionalProperties !== false) {
          transformed[key] = val;
        }
        continue;
      }

      // Apply field-level transformations based on validation strategy
      transformed[key] = this.applyFieldTransformation(val, fieldSchema, validationStrategy);
    }

    return transformed;
  }

  private applyTransformationRule(value: Record<string, unknown>, rule: PropertyTransformationRule): Record<string, unknown> {
    const fieldValue = value[rule.field];
    if (fieldValue === undefined) {
      return value;
    }

    const transformed = { ...value };

    switch (rule.transformationType) {
      case 'rename':
        if (rule.options?.newName) {
          transformed[rule.options.newName] = fieldValue;
          delete transformed[rule.field];
        }
        break;

      case 'normalize':
        transformed[rule.field] = this.normalizeValue(fieldValue, rule.options?.normalizeFormat);
        break;

      case 'format':
        transformed[rule.field] = this.formatValue(fieldValue, rule.options);
        break;

      case 'compute':
        if (rule.options?.computeExpression) {
          transformed[rule.field] = this.computeValue(value, rule.options.computeExpression);
        }
        break;

      case 'mask':
        transformed[rule.field] = this.maskValue(fieldValue, rule.options?.maskPattern);
        break;
    }

    return transformed;
  }

  private normalizeValue(value: unknown, format?: string): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    switch (format) {
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'trim':
        return value.trim();
      case 'slug':
        return value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      default:
        return value;
    }
  }

  private formatValue(value: unknown, options?: PropertyTransformationRule['options']): unknown {
    if (value instanceof Date && options?.dateFormat) {
      return this.formatDate(value, options.dateFormat);
    }

    if (typeof value === 'number' && options?.numberFormat) {
      const { precision, scale } = options.numberFormat;
      if (precision !== undefined) {
        return Number(value.toPrecision(precision));
      }
      if (scale !== undefined) {
        return Number(value.toFixed(scale));
      }
    }

    return value;
  }

  private computeValue(object: Record<string, unknown>, expression: string): unknown {
    // Simple expression evaluator for basic computations
    // In production, consider using a proper expression parser
    try {
      // Replace field references with actual values
      let evaluableExpression = expression;
      for (const [key, val] of Object.entries(object)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        evaluableExpression = evaluableExpression.replace(regex, String(val));
      }

      // Only allow basic mathematical operations for security
      if (!/^[0-9+\-*/.() ]+$/.test(evaluableExpression)) {
        return object[expression] ?? expression; // Fallback to field lookup or original
      }

      // Use safer evaluation - only allow basic math
      return this.safeEvaluate(evaluableExpression);
    } catch {
      return expression; // Return original expression if evaluation fails
    }
  }

  private maskValue(value: unknown, pattern?: string): unknown {
    if (typeof value !== 'string' || !pattern) {
      return value;
    }

    // Simple masking patterns
    switch (pattern) {
      case 'email': {
        const emailMatch = /^(.{1,2}).*@(.*)$/.exec(value);
        return emailMatch ? `${emailMatch[1]}***@${emailMatch[2]}` : value;
      }
      case 'phone':
        return value.replace(/\d(?=\d{4})/g, '*');
      case 'ssn':
        return value.replace(/\d(?=\d{4})/g, '*');
      default:
        return value.replace(/./g, '*');
    }
  }

  private formatDate(date: Date, format: string): string {
    // Simple date formatting - in production, use a proper date library
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day);
  }

  private applyFieldTransformation(value: unknown, fieldSchema: { type?: string }, validationStrategy?: ValidationStrategy): unknown {
    // Apply basic transformations based on field type and validation strategy
    if (validationStrategy === 'transform' || validationStrategy === 'sanitize') {
      // Apply type-specific transformations
      if (fieldSchema.type === 'string' && typeof value === 'string') {
        return value.trim();
      }

      if (fieldSchema.type === 'number' && typeof value === 'string' && !isNaN(Number(value))) {
        return Number(value);
      }

      if (fieldSchema.type === 'boolean' && typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
    }

    return value;
  }

  private safeEvaluate(expression: string): number | string {
    // Only allow basic mathematical operations for security
    const safeExpression = expression.replace(/[^0-9+\-*/.() ]/g, '');
    try {
      // Simple math evaluation without Function constructor
      if (/^[0-9+\-*/.() ]+$/.test(safeExpression)) {
        const result = eval(safeExpression) as unknown;
        return typeof result === 'number' ? result : String(result);
      }
    } catch {
      // Fall back to original expression if evaluation fails
    }
    return expression;
  }
}
