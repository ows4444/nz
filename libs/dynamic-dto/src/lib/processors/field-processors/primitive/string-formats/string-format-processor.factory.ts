import { Injectable } from '@nestjs/common';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';
import { PhoneFormatValidator } from './phone.format-validator';
import { TimeFormatValidator } from './time.format-validator';
import { DomainFormatValidator } from './domain.format-validator';
import { UsernameFormatValidator } from './username.format-validator';
import { PasswordFormatValidator } from './password.format-validator';
import { CurrencyFormatValidator } from './currency.format-validator';
import { CountryCodeFormatValidator } from './country-code.format-validator';
import { CoordinateFormatValidator } from './coordinate.format-validator';
import { SemverFormatValidator } from './semver.format-validator';
import { CronFormatValidator } from './cron.format-validator';

@Injectable()
export class StringFormatProcessorFactory {
  private readonly formatValidators = new Map<StringFormat, BaseStringFormatValidator>();

  constructor() {
    this.initializeValidators();
  }

  private initializeValidators(): void {
    const validators = [
      new PhoneFormatValidator(),
      new TimeFormatValidator(),
      new DomainFormatValidator(),
      new UsernameFormatValidator(),
      new PasswordFormatValidator(),
      new CurrencyFormatValidator(),
      new CountryCodeFormatValidator(),
      new CoordinateFormatValidator(),
      new SemverFormatValidator(),
      new CronFormatValidator(),
    ];

    validators.forEach((validator) => {
      this.formatValidators.set(validator.format, validator);
    });
  }

  getValidator(format: StringFormat): BaseStringFormatValidator | undefined {
    return this.formatValidators.get(format);
  }

  hasValidator(format: StringFormat): boolean {
    return this.formatValidators.has(format);
  }

  getAllFormats(): StringFormat[] {
    return Array.from(this.formatValidators.keys());
  }

  getBuiltInFormats(): StringFormat[] {
    return [
      StringFormat.email,
      StringFormat.url,
      StringFormat.uuid,
      StringFormat.date,
      StringFormat.datetime,
      StringFormat.ipv4,
      StringFormat.ipv6,
      StringFormat.mac_address,
      StringFormat.json,
      StringFormat.base64,
      StringFormat.hex,
      StringFormat.credit_card,
    ];
  }
}
