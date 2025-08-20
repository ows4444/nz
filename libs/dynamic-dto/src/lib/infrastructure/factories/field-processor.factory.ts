import type { Provider } from '@nestjs/common';
import { StringFieldProcessor } from '../../processors/field-processors/primitive/string-field.processor';
import { NumberFieldProcessor } from '../../processors/field-processors/primitive/number-field.processor';
import { BooleanFieldProcessor } from '../../processors/field-processors/primitive/boolean-field.processor';
import { DateFieldProcessor } from '../../processors/field-processors/specialized/date-field.processor';
import { EnumFieldProcessor } from '../../processors/field-processors/specialized/enum-field.processor';
import { UnionFieldProcessor } from '../../processors/field-processors/specialized/union-field.processor';
import { ArrayFieldProcessor } from '../../processors/field-processors/complex/array-field.processor';
import { ObjectFieldProcessor } from '../../processors/field-processors/complex/object-field.processor';

export function createFieldProcessorProviders(): Provider[] {
  return [
    // Primitive processors
    StringFieldProcessor,
    NumberFieldProcessor,
    BooleanFieldProcessor,

    // Specialized processors
    DateFieldProcessor,
    EnumFieldProcessor,
    UnionFieldProcessor,

    // Complex processors
    ArrayFieldProcessor,
    ObjectFieldProcessor,
  ];
}
