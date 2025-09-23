import { Injectable, Logger } from '@nestjs/common';
import { IPluginVersion } from '../types/core/plugin-strict-interfaces';

/**
 * Lightweight semantic version validator and utility
 * Implements basic semver parsing and compatibility checking without external dependencies
 */
@Injectable()
export class SemverValidator {
  private readonly logger = new Logger(SemverValidator.name);

  /**
   * Regular expression for validating semantic versions (e.g., 1.2.3, 1.2.3-alpha, 1.2.3+build)
   */
  private readonly semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

  /**
   * Regular expression for validating version ranges (e.g., ^1.2.3, ~1.2.3, >=1.2.3, 1.2.3 - 2.0.0)
   */
  private readonly rangeRegex =
    /^(?:([\^~]?)(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)|([>=]?|[<=]?|=)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)|(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)\s*-\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?))$/;

  /**
   * Validates if a version string follows semantic versioning
   * @param version Version string to validate
   * @returns true if valid semver, false otherwise
   */
  isValidSemver(version: string): boolean {
    if (!version || typeof version !== 'string') {
      return false;
    }
    return this.semverRegex.test(version.trim());
  }

  /**
   * Validates if a version range string is valid
   * @param range Version range string to validate (e.g., ^1.2.3, ~1.2.3, >=1.2.3)
   * @returns true if valid range, false otherwise
   */
  isValidVersionRange(range: string): boolean {
    if (!range || typeof range !== 'string') {
      return false;
    }

    const trimmedRange = range.trim();

    // Check if it's a simple version
    if (this.isValidSemver(trimmedRange)) {
      return true;
    }

    // Check if it's a valid range
    return this.rangeRegex.test(trimmedRange);
  }

  /**
   * Parses a semantic version string into components
   * @param version Version string to parse
   * @returns Parsed version object or null if invalid
   */
  parseVersion(version: string): IPluginVersion | null {
    if (!this.isValidSemver(version)) {
      this.logger.warn(`Invalid semver format: ${version}`);
      return null;
    }

    const match = version.trim().match(this.semverRegex);
    if (!match) {
      return null;
    }

    const [, major, minor, patch, prerelease, build] = match;

    return {
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10),
      prerelease: prerelease || undefined,
      build: build || undefined,
      raw: version.trim(),
    };
  }

  /**
   * Compares two semantic versions
   * @param version1 First version to compare
   * @param version2 Second version to compare
   * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2, null if either is invalid
   */
  compareVersions(version1: string, version2: string): number | null {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    if (!v1 || !v2) {
      return null;
    }

    // Compare major
    if (v1.major !== v2.major) {
      return v1.major > v2.major ? 1 : -1;
    }

    // Compare minor
    if (v1.minor !== v2.minor) {
      return v1.minor > v2.minor ? 1 : -1;
    }

    // Compare patch
    if (v1.patch !== v2.patch) {
      return v1.patch > v2.patch ? 1 : -1;
    }

    // Compare prerelease
    if (v1.prerelease && !v2.prerelease) {
      return -1; // prerelease < release
    }
    if (!v1.prerelease && v2.prerelease) {
      return 1; // release > prerelease
    }
    if (v1.prerelease && v2.prerelease) {
      return v1.prerelease.localeCompare(v2.prerelease);
    }

    return 0; // Equal
  }

  /**
   * Checks if a version satisfies a version range
   * @param version Version to check
   * @param range Version range to check against
   * @returns true if version satisfies range, false otherwise
   */
  satisfiesRange(version: string, range: string): boolean {
    if (!this.isValidSemver(version) || !this.isValidVersionRange(range)) {
      return false;
    }

    const trimmedRange = range.trim();

    // Exact match
    if (this.isValidSemver(trimmedRange)) {
      return version === trimmedRange;
    }

    // Caret range (^1.2.3 allows 1.x.x but not 2.0.0)
    if (trimmedRange.startsWith('^')) {
      const baseVersion = trimmedRange.slice(1);
      return this.satisfiesCaretRange(version, baseVersion);
    }

    // Tilde range (~1.2.3 allows 1.2.x but not 1.3.0)
    if (trimmedRange.startsWith('~')) {
      const baseVersion = trimmedRange.slice(1);
      return this.satisfiesTildeRange(version, baseVersion);
    }

    // Greater than or equal
    if (trimmedRange.startsWith('>=')) {
      const baseVersion = trimmedRange.slice(2).trim();
      const comparison = this.compareVersions(version, baseVersion);
      return comparison !== null && comparison >= 0;
    }

    // Greater than
    if (trimmedRange.startsWith('>')) {
      const baseVersion = trimmedRange.slice(1).trim();
      const comparison = this.compareVersions(version, baseVersion);
      return comparison !== null && comparison > 0;
    }

    // Less than or equal
    if (trimmedRange.startsWith('<=')) {
      const baseVersion = trimmedRange.slice(2).trim();
      const comparison = this.compareVersions(version, baseVersion);
      return comparison !== null && comparison <= 0;
    }

    // Less than
    if (trimmedRange.startsWith('<')) {
      const baseVersion = trimmedRange.slice(1).trim();
      const comparison = this.compareVersions(version, baseVersion);
      return comparison !== null && comparison < 0;
    }

    // Range (1.2.3 - 2.0.0)
    const rangeMatch = trimmedRange.match(/^(.+?)\s*-\s*(.+)$/);
    if (rangeMatch) {
      const [, minVersion, maxVersion] = rangeMatch;
      const minComparison = this.compareVersions(version, minVersion);
      const maxComparison = this.compareVersions(version, maxVersion);
      return minComparison !== null && maxComparison !== null && minComparison >= 0 && maxComparison <= 0;
    }

    return false;
  }

  /**
   * Checks if a version satisfies a caret range (^1.2.3)
   * @param version Version to check
   * @param baseVersion Base version for the range
   * @returns true if satisfies caret range, false otherwise
   */
  private satisfiesCaretRange(version: string, baseVersion: string): boolean {
    const v = this.parseVersion(version);
    const base = this.parseVersion(baseVersion);

    if (!v || !base) {
      return false;
    }

    // Must have same major version
    if (v.major !== base.major) {
      return false;
    }

    // Must be >= base version
    return this.compareVersions(version, baseVersion) !== null && this.compareVersions(version, baseVersion)! >= 0;
  }

  /**
   * Checks if a version satisfies a tilde range (~1.2.3)
   * @param version Version to check
   * @param baseVersion Base version for the range
   * @returns true if satisfies tilde range, false otherwise
   */
  private satisfiesTildeRange(version: string, baseVersion: string): boolean {
    const v = this.parseVersion(version);
    const base = this.parseVersion(baseVersion);

    if (!v || !base) {
      return false;
    }

    // Must have same major and minor version
    if (v.major !== base.major || v.minor !== base.minor) {
      return false;
    }

    // Must be >= base version
    return this.compareVersions(version, baseVersion) !== null && this.compareVersions(version, baseVersion)! >= 0;
  }

  /**
   * Gets the latest compatible version from a list of versions for a given range
   * @param versions List of available versions
   * @param range Version range to check against
   * @returns Latest compatible version or null if none found
   */
  getLatestCompatibleVersion(versions: string[], range: string): string | null {
    const compatibleVersions = versions.filter((version) => this.satisfiesRange(version, range));

    if (compatibleVersions.length === 0) {
      return null;
    }

    // Sort versions and return the latest
    compatibleVersions.sort((a, b) => this.compareVersions(b, a) || 0);
    return compatibleVersions[0];
  }

  /**
   * Validates multiple dependency versions against their constraints
   * @param dependencies Object mapping dependency names to their version constraints
   * @param availableVersions Object mapping dependency names to their available versions
   * @returns Validation result with errors and compatible versions
   */
  validateDependencyVersions(
    dependencies: Record<string, string>,
    availableVersions: Record<string, string>
  ): {
    valid: boolean;
    errors: string[];
    compatibleVersions: Record<string, boolean>;
  } {
    const errors: string[] = [];
    const compatibleVersions: Record<string, boolean> = {};

    for (const [depName, versionRange] of Object.entries(dependencies)) {
      // Validate version range format
      if (!this.isValidVersionRange(versionRange)) {
        errors.push(`Invalid version range for dependency '${depName}': ${versionRange}`);
        compatibleVersions[depName] = false;
        continue;
      }

      // Check if dependency is available
      const availableVersion = availableVersions[depName];
      if (!availableVersion) {
        errors.push(`Dependency '${depName}' is not available`);
        compatibleVersions[depName] = false;
        continue;
      }

      // Validate available version format
      if (!this.isValidSemver(availableVersion)) {
        errors.push(`Invalid semver for dependency '${depName}': ${availableVersion}`);
        compatibleVersions[depName] = false;
        continue;
      }

      // Check compatibility
      const isCompatible = this.satisfiesRange(availableVersion, versionRange);
      compatibleVersions[depName] = isCompatible;

      if (!isCompatible) {
        errors.push(`Dependency '${depName}' version ${availableVersion} does not satisfy range ${versionRange}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      compatibleVersions,
    };
  }
}
