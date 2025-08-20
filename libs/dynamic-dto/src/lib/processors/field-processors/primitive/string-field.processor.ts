import { Injectable } from '@nestjs/common';
import {
  IsBase64,
  IsCreditCard,
  IsDateString,
  IsDefined,
  IsEmail,
  IsHexadecimal,
  IsIP,
  IsJSON,
  IsMACAddress,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { v4 as uuidv4 } from 'uuid';
import { BaseFieldProcessor } from '../../../core/abstractions/base-field-processor.abstract';
import { type TransformationFunction } from '../../../core/abstractions/transformation-processor.abstract';
import { AutoGenerateConfig, AutoGenerationType, CaseTransform, StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { StringFormat } from '../../../core/enums/string.enums';

@Injectable()
export class StringFieldProcessor extends BaseFieldProcessor<StringFieldSchema> {
  // Static regex patterns cache for performance
  private static readonly REGEX_CACHE = {
    PHONE_CLEANUP: /[^+\d]/g,
    WHITESPACE: /\s/g,
    SPACES_MULTIPLE: /\s+/g,
    HASH_PREFIX: /^#/,
    TITLE_CASE: /\w\S*/g,
    WORD_BOUNDARY: /\b\w/g,
    CAMEL_PASCAL: /(?:^\w|[A-Z]|\b\w)/g,
    ESCAPE_REGEX: /[-/\\^$*+?.()|[\]{}]/g,
    MAC_SEPARATORS: /[-:\s]/g,
  };
  readonly supportedType = FieldType.string;

  canProcess(schema: FieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string;
  }

  generateValidationDecorators(schema: StringFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined(parentIsArray ? { each: true } : undefined));

      if (!schema.nullable) {
        decorators.push(IsNotEmpty(parentIsArray ? { each: true } : undefined));
      }
    } else {
      decorators.push(IsOptional(parentIsArray ? { each: true } : undefined));
    }

    // Type validation
    decorators.push(IsString(parentIsArray ? { each: true } : undefined));

    // Length validation
    if (schema.minLength !== undefined || schema.maxLength !== undefined) {
      const min = schema.minLength ?? 0;
      const max = schema.maxLength ?? Number.MAX_SAFE_INTEGER;
      decorators.push(Length(min, max, parentIsArray ? { each: true } : undefined));
    }

    // Pattern validation
    if (schema.pattern) {
      decorators.push(Matches(new RegExp(schema.pattern), parentIsArray ? { each: true } : undefined));
    }

    // Format validation - comprehensive implementation
    if (schema.format) {
      const eachOption = parentIsArray ? { each: true } : undefined;

      switch (schema.format) {
        case StringFormat.email:
          decorators.push(IsEmail({}, eachOption));
          break;
        case StringFormat.url:
          decorators.push(IsUrl({}, eachOption));
          break;
        case StringFormat.uuid:
          decorators.push(IsUUID(undefined, eachOption));
          break;
        case StringFormat.date:
          decorators.push(IsDateString({}, eachOption));
          break;
        case StringFormat.time:
          decorators.push(this.createTimeValidator(eachOption));
          break;
        case StringFormat.datetime:
          decorators.push(IsDateString({}, eachOption));
          break;
        case StringFormat.phone:
        case StringFormat.mobile:
          decorators.push(this.createPhoneValidator(eachOption));
          break;
        case StringFormat.ipv4:
          decorators.push(IsIP(4, eachOption));
          break;
        case StringFormat.ipv6:
          decorators.push(IsIP(6, eachOption));
          break;
        case StringFormat.mac_address:
          decorators.push(IsMACAddress(eachOption));
          break;
        case StringFormat.domain:
          decorators.push(this.createDomainValidator(eachOption));
          break;
        case StringFormat.username:
          decorators.push(this.createUsernameValidator(eachOption));
          break;
        case StringFormat.password:
          decorators.push(this.createPasswordValidator(eachOption));
          break;
        case StringFormat.json:
          decorators.push(IsJSON(eachOption));
          break;
        case StringFormat.base64:
          decorators.push(IsBase64({}, eachOption));
          break;
        case StringFormat.hex:
          decorators.push(IsHexadecimal(eachOption));
          break;
        case StringFormat.currency:
          decorators.push(this.createCurrencyValidator(eachOption));
          break;
        case StringFormat.credit_card:
          decorators.push(IsCreditCard(eachOption));
          break;
        case StringFormat.country_code:
          decorators.push(this.createCountryCodeValidator(eachOption));
          break;
        case StringFormat.postal_code:
          decorators.push(this.createPostalCodeValidator(eachOption));
          break;
        case StringFormat.coordinate:
          decorators.push(this.createCoordinateValidator(eachOption));
          break;
        case StringFormat.semver:
          decorators.push(this.createSemverValidator(eachOption));
          break;
        case StringFormat.cron:
          decorators.push(this.createCronValidator(eachOption));
          break;
        case StringFormat.html:
          decorators.push(this.createHtmlValidator(eachOption));
          break;
        case StringFormat.xml:
          // decorators.push(this.createXmlValidator(eachOption));
          break;
        default:
          // For unknown formats, apply a generic regex if pattern is provided
          if (schema.pattern) {
            decorators.push(Matches(new RegExp(schema.pattern), eachOption));
          }
          break;
      }
    }

    return decorators;
  }

  getTypeSpecificTransformations(schema: StringFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Auto-generation transformation (order: 30)
    if (schema.autoGenerate) {
      functions.push({
        order: 30,
        name: 'auto_generate',
        transform: ({ value }) => {
          switch (schema.autoGenerate) {
            case AutoGenerationType.uuid:
              return uuidv4();
            case AutoGenerationType.timestamp:
              return new Date().toISOString();
            case AutoGenerationType.random_string:
              return this.generateRandomString(schema.autoGenerateConfig);
            case AutoGenerationType.slug:
              return this.generateSlug(schema.autoGenerateConfig);
            case AutoGenerationType.hash:
              return this.generateHash(schema.autoGenerateConfig);
            default:
              return value;
          }
        },
        condition: (_, { value }) => {
          if (schema.readonly === true) return true;

          return value === undefined;
        },
      });
    }

    // String transformation (order: 40)
    functions.push({
      order: 40,
      name: 'string_processing',
      transform: ({ value }) => {
        if (typeof value !== 'string') return value;

        let result = value;

        if (schema.trimming) {
          const { start = false, end = false, inner = false, chars, preserve = [] } = schema.trimming;

          const escapeRegex = (str: string) => str.replace(StringFieldProcessor.REGEX_CACHE.ESCAPE_REGEX, '\\$&');

          // Build the trim character set
          let trimChars = chars ?? ' \t\n\r';
          if (preserve.length > 0) {
            const preservedSet = new Set(preserve);
            trimChars = trimChars
              .split('')
              .filter((c) => !preservedSet.has(c))
              .join('');
          }

          // Create regex for trimming (compile once for better performance)
          const escapedTrimChars = escapeRegex(trimChars);
          const trimStartRegex = start ? new RegExp(`^[${escapedTrimChars}]+`) : null;
          const trimEndRegex = end ? new RegExp(`[${escapedTrimChars}]+$`) : null;
          const trimInnerRegex = inner ? new RegExp(`[${escapedTrimChars}]{2,}`, 'g') : null;

          if (trimStartRegex) result = result.replace(trimStartRegex, '');
          if (trimEndRegex) result = result.replace(trimEndRegex, '');
          if (trimInnerRegex) result = result.replace(trimInnerRegex, ' ');
        }

        // Case transformation
        if (schema.caseTransform) {
          result = this.applyCaseTransform(result, schema.caseTransform);
        }

        return result;
      },
      condition: (_, { value }) => typeof value === 'string',
    });

    // Format validation and transformation (order: 50)
    if (schema.format) {
      functions.push({
        order: 50,
        name: 'format_normalization',
        transform: ({ value }) => {
          if (typeof value !== 'string') return value;

          switch (schema.format) {
            case StringFormat.email:
              return value.toLowerCase().trim();
            case StringFormat.url:
              return this.normalizeUrl(value);
            case StringFormat.domain:
              return value.toLowerCase().trim();
            case StringFormat.username:
              return value.toLowerCase().trim();
            case StringFormat.country_code:
              return value.toUpperCase().trim();
            case StringFormat.postal_code:
              return value.toUpperCase().replace(StringFieldProcessor.REGEX_CACHE.WHITESPACE, '');
            case StringFormat.hex:
              return value.toLowerCase().replace(StringFieldProcessor.REGEX_CACHE.HASH_PREFIX, '');
            case StringFormat.base64:
              return value.replace(StringFieldProcessor.REGEX_CACHE.WHITESPACE, '');
            case StringFormat.mac_address:
              return value.toLowerCase().replace(StringFieldProcessor.REGEX_CACHE.MAC_SEPARATORS, ':');
            case StringFormat.phone:
            case StringFormat.mobile:
              return value.replace(StringFieldProcessor.REGEX_CACHE.PHONE_CLEANUP, '');
            case StringFormat.uuid:
              return value.toLowerCase();
            case StringFormat.json:
              try {
                return JSON.stringify(JSON.parse(value));
              } catch {
                return value;
              }
            default:
              return value;
          }
        },
        condition: (_, { value }) => typeof value === 'string',
      });
    }

    return functions;
  }

  private generateRandomString(config?: AutoGenerateConfig): string {
    const length = config?.length ?? 8;
    const chars = config?.charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charsLength = chars.length;
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = chars[Math.floor(Math.random() * charsLength)];
    }
    return result.join('');
  }

  private generateSlug(config?: AutoGenerateConfig): string {
    const base = config?.template ?? 'auto-generated';
    return base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private generateHash(config?: AutoGenerateConfig): string {
    const input = config?.template ?? Date.now().toString();
    return btoa(input)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, config?.length ?? 16);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return url;
    }
  }

  private applyCaseTransform(value: string, transform: CaseTransform): string {
    switch (transform) {
      case CaseTransform.LOWER:
        return value.toLowerCase();
      case CaseTransform.UPPER:
        return value.toUpperCase();
      case CaseTransform.TITLE:
        return value.replace(StringFieldProcessor.REGEX_CACHE.TITLE_CASE, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      case CaseTransform.SENTENCE:
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case CaseTransform.CAMEL:
        return value
          .replace(StringFieldProcessor.REGEX_CACHE.CAMEL_PASCAL, (word, index) => (index === 0 ? word.toLowerCase() : word.toUpperCase()))
          .replace(StringFieldProcessor.REGEX_CACHE.SPACES_MULTIPLE, '');
      case CaseTransform.PASCAL:
        return value.replace(StringFieldProcessor.REGEX_CACHE.CAMEL_PASCAL, (word) => word.toUpperCase()).replace(StringFieldProcessor.REGEX_CACHE.SPACES_MULTIPLE, '');
      case CaseTransform.SNAKE:
        return value.toLowerCase().replace(StringFieldProcessor.REGEX_CACHE.SPACES_MULTIPLE, '_');
      case CaseTransform.KEBAB:
        return value.toLowerCase().replace(StringFieldProcessor.REGEX_CACHE.SPACES_MULTIPLE, '-');
      case CaseTransform.CONSTANT:
        return value.toUpperCase().replace(StringFieldProcessor.REGEX_CACHE.SPACES_MULTIPLE, '_');
      case CaseTransform.CAPITALIZE_FIRST:
        return value.charAt(0).toUpperCase() + value.slice(1);
      case CaseTransform.CAPITALIZE_WORDS:
        return value.replace(StringFieldProcessor.REGEX_CACHE.WORD_BOUNDARY, (l) => l.toUpperCase());
      case CaseTransform.NONE:
      default:
        return value;
    }
  }

  // Custom validation decorator creators
  private createTimeValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isTime',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // HH:MM or HH:MM:SS format
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid time format (HH:MM or HH:MM:SS)`;
          },
        },
      });
    };
  }

  private createPhoneValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isPhone',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // International phone number format
            return /^\+?[1-9]\d{1,14}$/.test(value.replace(/[^\d+]/g, ''));
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid phone number`;
          },
        },
      });
    };
  }

  private createDomainValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isDomain',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid domain name`;
          },
        },
      });
    };
  }

  private createUsernameValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isUsername',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // 3-30 characters, alphanumeric, underscore, hyphen
            return /^[a-zA-Z0-9_-]{3,30}$/.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid username (3-30 characters, alphanumeric, underscore, hyphen)`;
          },
        },
      });
    };
  }

  private createPasswordValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isStrongPassword',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // At least 8 chars, 1 upper, 1 lower, 1 number, 1 special
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a strong password (min 8 chars, 1 upper, 1 lower, 1 number, 1 special character)`;
          },
        },
      });
    };
  }

  private createCurrencyValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isCurrency',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            return /^[A-Z]{3}$/.test(value); // ISO 4217 currency codes
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid ISO 4217 currency code`;
          },
        },
      });
    };
  }

  private createCountryCodeValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isCountryCode',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            return /^[A-Z]{2}$/.test(value); // ISO 3166-1 alpha-2
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid ISO 3166-1 alpha-2 country code`;
          },
        },
      });
    };
  }

  private createPostalCodeValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isPostalCode',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // Generic postal code pattern (supports various formats)
            return /^[A-Z0-9\s-]{3,10}$/i.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid postal code`;
          },
        },
      });
    };
  }

  private createCoordinateValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isCoordinate',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // Lat,Lng format: "40.7128,-74.0060"
            const coords = value.split(',');
            if (coords.length !== 2) return false;
            const latStr = coords[0]?.trim();
            const lngStr = coords[1]?.trim();
            if (!latStr || !lngStr) return false;
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be valid coordinates in "latitude,longitude" format`;
          },
        },
      });
    };
  }

  private createSemverValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isSemver',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid semantic version`;
          },
        },
      });
    };
  }

  private createCronValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isCron',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            const parts = value.trim().split(/\s+/);
            if (parts.length !== 5 && parts.length !== 6) return false;
            // Basic cron validation (can be enhanced)
            return parts.every((part) => /^[\d*,\-/]+$/.test(part) || part === '?');
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid cron expression`;
          },
        },
      });
    };
  }

  private createHtmlValidator(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyName: string | symbol) => {
      registerDecorator({
        name: 'isHtml',
        target: target.constructor,
        propertyName: String(propertyName),
        options: validationOptions ?? {},
        validator: {
          validate(value: unknown) {
            if (typeof value !== 'string') return false;
            // Basic HTML validation - contains HTML tags
            return /<\/?[a-z][\s\S]*>/i.test(value);
          },
          defaultMessage(args: ValidationArguments) {
            return `${args.property} must be valid HTML`;
          },
        },
      });
    };
  }

  // private createXmlValidator(validationOptions?: ValidationOptions): PropertyDecorator {
  //   return (target: object, propertyName: string | symbol) => {
  //     registerDecorator({
  //       name: 'isXml',
  //       target: target.constructor,
  //       propertyName: String(propertyName),
  //       options: validationOptions ?? {},
  //       validator: {
  //         validate(value: unknown) {
  //           if (typeof value !== 'string') return false;
  //           try {
  //             // Basic XML structure validation
  //             const parser = new DOMParser();
  //             const doc = parser.parseFromString(value, 'text/xml');
  //             return !doc.querySelector('parsererror');
  //           } catch {
  //             return false;
  //           }
  //         },
  //         defaultMessage(args: ValidationArguments) {
  //           return `${args.property} must be valid XML`;
  //         },
  //       },
  //     });
  //   };
  // }
}
