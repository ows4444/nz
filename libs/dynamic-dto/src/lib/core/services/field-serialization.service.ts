import { Injectable } from '@nestjs/common';
import { Exclude, Expose } from 'class-transformer';
import type { FieldSchema } from '../interfaces/schema';
import type { FieldPermissions } from '../interfaces/schema/base/base-field.schema';

export interface SerializationContext {
  userRoles?: string[];
  operation?: 'create' | 'read' | 'update' | 'delete';
  includeHidden?: boolean;
  includeDeprecated?: boolean;
  locale?: string;
  userId?: string;
}

export interface FieldSerializationService {
  generateSerializationDecorators(schema: FieldSchema, isRequired: boolean, isArray: boolean, context?: SerializationContext): PropertyDecorator[];
  checkFieldPermissions(permissions: FieldPermissions, context: SerializationContext): boolean;
}

@Injectable()
export class DefaultFieldSerializationService implements FieldSerializationService {
  generateSerializationDecorators(schema: FieldSchema, _isRequired: boolean, _isArray: boolean, context?: SerializationContext): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Handle field visibility
    if (schema.permissions) {
      const shouldExpose = this.shouldExposeField(schema.permissions, context);
      if (shouldExpose) {
        decorators.push(Expose());
      } else {
        decorators.push(Exclude());
      }
    }

    // Handle explicit expose/exclude
    if (schema.expose) {
      decorators.push(Expose());
    } else if (schema.exclude) {
      decorators.push(Exclude());
    }

    return decorators;
  }

  checkFieldPermissions(permissions: FieldPermissions, context: SerializationContext): boolean {
    // Check operation-based permissions using the actual FieldPermissions structure
    if (context.operation) {
      switch (context.operation) {
        case 'read':
          return !permissions.read || context.userRoles?.some((role) => permissions.read?.includes(role)) === true;
        case 'create':
          return !permissions.create || context.userRoles?.some((role) => permissions.create?.includes(role)) === true;
        case 'update':
          return !permissions.update || context.userRoles?.some((role) => permissions.update?.includes(role)) === true;
        case 'delete':
          return !permissions.delete || context.userRoles?.some((role) => permissions.delete?.includes(role)) === true;
      }
    }

    return true;
  }

  private shouldExposeField(permissions: FieldPermissions, context?: SerializationContext): boolean {
    // If no context provided, default to exposing the field
    if (!context) {
      return true;
    }

    // If no permissions defined on the field, expose it
    if (!permissions) {
      return true;
    }

    // Check operation-based permissions
    if (context.operation) {
      const relevantPermissions = this.getRelevantPermissions(permissions, context.operation);

      // If no specific permissions are set for this operation, allow access
      if (!relevantPermissions || relevantPermissions.length === 0) {
        return true;
      }

      // If user has no roles, deny access when permissions are required
      if (!context.userRoles || context.userRoles.length === 0) {
        return false;
      }

      // Check if user has any of the required roles
      return context.userRoles.some((role) => relevantPermissions.includes(role));
    }

    // Default to exposing if no specific operation context
    return true;
  }

  private getRelevantPermissions(permissions: FieldPermissions, operation: string): readonly string[] | undefined {
    switch (operation) {
      case 'read':
        return permissions.read;
      case 'create':
        return permissions.create;
      case 'update':
        return permissions.update;
      case 'delete':
        return permissions.delete;
      default:
        return undefined;
    }
  }

  private buildSerializationCondition(conditional: unknown): (obj: unknown) => boolean {
    return (obj: unknown) => {
      if (typeof conditional === 'function') {
        return conditional(obj);
      }
      return true;
    };
  }
}
