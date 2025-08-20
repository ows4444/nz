import { Exclude, Expose } from 'class-transformer';
import type { FieldPermissions, FieldSchema } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';

export interface SerializationContext {
  userRoles?: string[];
  operation?: 'create' | 'read' | 'update' | 'delete';
  includeHidden?: boolean;
  includeDeprecated?: boolean;
  locale?: string;
  userId?: string;
  version?: string;
}

export abstract class SerializationProcessor<T extends FieldSchema = FieldSchema> {
  abstract readonly supportedType: FieldTypeValue;

  abstract canProcess(schema: FieldSchema): schema is T;

  public generateSerializationDecorators(schema: T, isRequired: boolean, excludeAll: boolean, context?: SerializationContext): PropertyDecorator[] {
    if (this.shouldExcludeForPermissions(schema, context)) return [Exclude()];
    if (this.shouldExcludeForHidden(schema, context)) return [Exclude()];
    if (this.shouldExcludeForDeprecated(schema, context)) return [Exclude()];

    const decorators: PropertyDecorator[] = [];

    if ((excludeAll && schema.expose) || isRequired) decorators.push(Expose());
    if (!excludeAll && schema.exclude) decorators.push(Exclude());

    return decorators;
  }

  protected shouldExcludeForPermissions(schema: T, context?: SerializationContext): boolean {
    if (!context?.userRoles || !('permissions' in schema) || !schema.permissions) return false;
    return !this.checkOperationPermission(schema.permissions, context.userRoles, context.operation);
  }

  protected shouldExcludeForHidden(schema: T, context?: SerializationContext): boolean {
    return !!('displayHints' in schema && schema.displayHints?.hidden) && !context?.includeHidden;
  }

  protected shouldExcludeForDeprecated(schema: T, context?: SerializationContext): boolean {
    return !!('deprecated' in schema && schema.deprecated) && !context?.includeDeprecated;
  }

  protected checkOperationPermission(permissions: FieldPermissions, userRoles: string[], operation?: 'create' | 'read' | 'update' | 'delete'): boolean {
    if (!userRoles?.length) return false;

    const roleMap = {
      create: permissions.create ?? permissions.write ?? [],
      read: permissions.read ?? [],
      update: permissions.update ?? permissions.write ?? [],
      delete: permissions.delete ?? permissions.write ?? [],
    };

    const requiredRoles = roleMap[operation ?? 'read'] ?? [];
    return this.checkPermission(requiredRoles, userRoles);
  }

  protected checkPermission(allowedRoles?: readonly string[], userRoles?: readonly string[]): boolean {
    if (!allowedRoles?.length) return true;
    return allowedRoles.some((role) => userRoles?.includes(role));
  }
}
