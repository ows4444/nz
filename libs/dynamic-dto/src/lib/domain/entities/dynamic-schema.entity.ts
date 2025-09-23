import type { FieldSchema } from '../../core/interfaces/schema';

export class DynamicSchemaEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly properties: Record<string, FieldSchema>,
    public readonly required: string[] = [],
    public readonly excludeAll = false,
    public readonly metadata?: Record<string, unknown>
  ) {}

  public getRequiredFields(): string[] {
    return [...this.required];
  }

  public hasField(fieldName: string): boolean {
    return fieldName in this.properties;
  }
}
