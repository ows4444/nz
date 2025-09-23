import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class CoordinateFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.coordinate;
  readonly validatorName = 'isCoordinate';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const coords = value.split(',');
    if (coords.length !== 2) return false;
    const latStr = coords[0]?.trim();
    const lngStr = coords[1]?.trim();
    if (!latStr || !lngStr) return false;
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be valid coordinates in "latitude,longitude" format`;
  }
}
