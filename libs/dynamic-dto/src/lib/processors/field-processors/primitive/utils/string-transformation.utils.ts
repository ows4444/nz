import { CaseTransform } from '../../../../core/interfaces/schema/primitive/string-field.schema';

/**
 * Shared transformation utilities for string field processors.
 * Provides optimized regex patterns and transformation functions
 * to reduce code duplication across processors.
 */
export class StringTransformationUtils {
  // Pre-compiled regex patterns for optimal performance
  private static readonly regexPatterns = {
    spaces_multiple: /\s+/g,
    title_case: /\w\S*/g,
    word_boundary: /\b\w/g,
    camel_pascal: /(?:^\w|[A-Z]|\b\w)/g,
    escape_regex: /[-/\\^$*+?.()|[\]{}]/g,
    whitespace: /\s/g,
    phone_cleanup: /[^+\d]/g,
    hash_prefix: /^#/,
    mac_separators: /[-:\s]/g,
  } as const;

  // Dynamic pattern cache for runtime regex patterns
  private static readonly patternCache = new Map<string, RegExp>();
  private static readonly maxPatternCacheSize = 500;

  /**
   * Apply case transformation to a string value
   */
  static applyCaseTransform(value: string, transform: CaseTransform): string {
    switch (transform) {
      case CaseTransform.LOWER:
        return value.toLowerCase();
      case CaseTransform.UPPER:
        return value.toUpperCase();
      case CaseTransform.TITLE:
        return value.replace(this.regexPatterns.title_case, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      case CaseTransform.SENTENCE:
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case CaseTransform.CAMEL:
        return value.replace(this.regexPatterns.camel_pascal, (word, index) => (index === 0 ? word.toLowerCase() : word.toUpperCase())).replace(this.regexPatterns.spaces_multiple, '');
      case CaseTransform.PASCAL:
        return value.replace(this.regexPatterns.camel_pascal, (word) => word.toUpperCase()).replace(this.regexPatterns.spaces_multiple, '');
      case CaseTransform.SNAKE:
        return value.toLowerCase().replace(this.regexPatterns.spaces_multiple, '_');
      case CaseTransform.KEBAB:
        return value.toLowerCase().replace(this.regexPatterns.spaces_multiple, '-');
      case CaseTransform.CONSTANT:
        return value.toUpperCase().replace(this.regexPatterns.spaces_multiple, '_');
      case CaseTransform.DOT:
        return value.toLowerCase().replace(this.regexPatterns.spaces_multiple, '.');
      case CaseTransform.PATH:
        return value.toLowerCase().replace(this.regexPatterns.spaces_multiple, '/');
      case CaseTransform.HEADER:
        return value.toLowerCase().replace(this.regexPatterns.spaces_multiple, '-');
      case CaseTransform.ALTERNATING:
        return value
          .split('')
          .map((char, index) => (index % 2 === 0 ? char.toLowerCase() : char.toUpperCase()))
          .join('');
      case CaseTransform.INVERSE:
        return value
          .split('')
          .map((char) => (char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase()))
          .join('');
      case CaseTransform.CAPITALIZE_FIRST:
        return value.charAt(0).toUpperCase() + value.slice(1);
      case CaseTransform.CAPITALIZE_WORDS:
        return value.replace(this.regexPatterns.word_boundary, (l) => l.toUpperCase());
      case CaseTransform.NONE:
      default:
        return value;
    }
  }

  /**
   * Apply trimming operations to a string value
   */
  static applyTrimming(
    value: string,
    trimming: {
      start?: boolean;
      end?: boolean;
      inner?: boolean;
      chars?: string;
      preserve?: string[];
    }
  ): string {
    const { start = false, end = false, inner = false, chars, preserve = [] } = trimming;

    // Build the trim character set
    let trimChars = chars ?? ' \t\n\r';
    if (preserve.length > 0) {
      const preservedSet = new Set(preserve);
      trimChars = trimChars
        .split('')
        .filter((c) => !preservedSet.has(c))
        .join('');
    }

    let result = value;

    // Create regex for trimming (compile once for better performance)
    const escapedTrimChars = this.escapeRegex(trimChars);

    if (start) {
      const trimStartRegex = this.getCachedTrimRegex(`^[${escapedTrimChars}]+`);
      result = result.replace(trimStartRegex, '');
    }

    if (end) {
      const trimEndRegex = this.getCachedTrimRegex(`[${escapedTrimChars}]+$`);
      result = result.replace(trimEndRegex, '');
    }

    if (inner) {
      const trimInnerRegex = this.getCachedTrimRegex(`[${escapedTrimChars}]{2,}`, 'g');
      result = result.replace(trimInnerRegex, ' ');
    }

    return result;
  }

  /**
   * Format-specific transformation utilities
   */
  static applyFormatTransformation(value: string, format: string): string {
    switch (format) {
      case 'email':
        return value.toLowerCase().trim();
      case 'url':
        return this.normalizeUrl(value);
      case 'postal_code':
        return value.toUpperCase().replace(this.regexPatterns.whitespace, '');
      case 'hex':
        return value.toLowerCase().replace(this.regexPatterns.hash_prefix, '');
      case 'base64':
        return value.replace(this.regexPatterns.whitespace, '');
      case 'mac_address':
        return value.toLowerCase().replace(this.regexPatterns.mac_separators, ':');
      case 'mobile':
      case 'phone':
        return value.replace(this.regexPatterns.phone_cleanup, '');
      case 'uuid':
        return value.toLowerCase();
      case 'json':
        try {
          return JSON.stringify(JSON.parse(value));
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  /**
   * Escape special regex characters for safe pattern usage
   */
  private static escapeRegex(str: string): string {
    return str.replace(this.regexPatterns.escape_regex, '\\$&');
  }

  /**
   * Get or create a cached trimming regex pattern
   */
  private static getCachedTrimRegex(pattern: string, flags?: string): RegExp {
    const cacheKey = flags ? `${pattern}:::${flags}` : pattern;

    if (!this.patternCache.has(cacheKey)) {
      // Prevent cache from growing too large
      if (this.patternCache.size >= this.maxPatternCacheSize) {
        this.clearPatternCache();
      }
      this.patternCache.set(cacheKey, new RegExp(pattern, flags));
    }

    return this.patternCache.get(cacheKey)!;
  }

  /**
   * Normalize URL for consistency
   */
  private static normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return url;
    }
  }

  /**
   * Clear the pattern cache when it gets too large
   */
  static clearPatternCache(): void {
    this.patternCache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats() {
    return {
      size: this.patternCache.size,
      maxSize: this.maxPatternCacheSize,
      keys: Array.from(this.patternCache.keys()),
    };
  }
}
