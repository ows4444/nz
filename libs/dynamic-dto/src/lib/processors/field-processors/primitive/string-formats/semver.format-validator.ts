import type { ValidationArguments } from 'class-validator';
import { StringFormat } from '../../../../core/enums/string.enums';
import { BaseStringFormatValidator } from './base-string-format.validator';

export class SemverFormatValidator extends BaseStringFormatValidator {
  readonly format = StringFormat.semver;
  readonly validatorName = 'isSemVer';

  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;

    // Parse the semver string manually for better control
    const semverMatch = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$/.exec(value);

    if (!semverMatch) {
      return false;
    }

    const [, major, minor, patch, prerelease, buildMetadata] = semverMatch;

    // Validate major, minor, patch are valid numbers (no leading zeros unless '0')
    if (!major || !minor || !patch || !this.isValidVersionNumber(major) || !this.isValidVersionNumber(minor) || !this.isValidVersionNumber(patch)) {
      return false;
    }

    // Validate prerelease identifiers if present
    if (prerelease) {
      const prereleaseIdentifiers = prerelease.split('.');
      if (prereleaseIdentifiers.length === 0 || prereleaseIdentifiers.some((id) => !id)) {
        return false; // Empty identifiers not allowed
      }

      for (const identifier of prereleaseIdentifiers) {
        // Must be alphanumeric or hyphen, and numeric identifiers cannot have leading zeros
        if (!/^[0-9a-zA-Z-]+$/.test(identifier)) {
          return false;
        }

        // If it's numeric, check for leading zeros
        if (/^\d+$/.test(identifier) && identifier !== '0' && identifier.startsWith('0')) {
          return false;
        }
      }
    }

    // Build metadata can contain any alphanumeric characters, hyphens, dots, and plus signs
    // Being more permissive to handle complex edge cases
    if (buildMetadata) {
      if (!buildMetadata || buildMetadata.trim() === '' || buildMetadata === '+' || buildMetadata === '-' || buildMetadata === '+-') {
        return false;
      }
      // Allow alphanumeric characters, hyphens, dots, and plus signs
      if (!/^[0-9a-zA-Z.+-]+$/.test(buildMetadata)) {
        return false;
      }
    }

    return true;
  }

  private isValidVersionNumber(versionPart: string): boolean {
    // Must be numeric and not have leading zeros (unless it's just '0')
    return /^\d+$/.test(versionPart) && (versionPart === '0' || !versionPart.startsWith('0'));
  }

  override transform(value: string): string {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? '' : trimmed;
  }

  getDefaultMessage(args: ValidationArguments): string {
    const property = args?.property || 'field';
    return `${property} must be a valid semantic version`;
  }
}
