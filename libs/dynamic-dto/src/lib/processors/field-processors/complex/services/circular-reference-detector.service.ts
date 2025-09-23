import { Injectable } from '@nestjs/common';

export interface CircularReferenceContext {
  visited: WeakSet<object>;
  maxDepth: number;
  currentDepth: number;
}

@Injectable()
export class CircularReferenceDetectorService {
  private static readonly defaultMaxDepth = 10;
  private static readonly maxCacheSize = 1000;
  private readonly pathCache = new Map<string, boolean>();

  detectAndHandleCircularReferences(value: Record<string, unknown>, maxDepth: number = CircularReferenceDetectorService.defaultMaxDepth): Record<string, unknown> {
    const context: CircularReferenceContext = {
      visited: new WeakSet(),
      maxDepth,
      currentDepth: 0,
    };

    return this.processObjectWithContext(value, context, '');
  }

  private processObjectWithContext(value: Record<string, unknown>, context: CircularReferenceContext, pathKey: string): Record<string, unknown> {
    // Check depth limit first (most efficient check)
    if (context.currentDepth >= context.maxDepth) {
      throw new Error(`Maximum nesting depth (${context.maxDepth}) exceeded at path: ${pathKey}`);
    }

    // Check for circular reference using WeakSet (most reliable)
    if (context.visited.has(value)) {
      throw new Error(`Circular reference detected at path: ${pathKey}`);
    }

    // Mark as visited
    context.visited.add(value);

    // Add to path cache for performance tracking (bounded cache)
    if (pathKey && this.pathCache.size < CircularReferenceDetectorService.maxCacheSize) {
      this.pathCache.set(pathKey, true);
    } else if (pathKey && this.pathCache.size >= CircularReferenceDetectorService.maxCacheSize) {
      this.evictCacheIfNeeded();
      this.pathCache.set(pathKey, true);
    }

    const result: Record<string, unknown> = {};
    const nextDepth = context.currentDepth + 1;

    try {
      for (const [key, val] of Object.entries(value)) {
        const nextPath = pathKey ? `${pathKey}.${key}` : key;
        result[key] = this.processValue(val, { ...context, currentDepth: nextDepth }, nextPath);
      }
    } finally {
      // Always remove from visited set, even if an error occurred
      context.visited.delete(value);
    }

    return result;
  }

  private processValue(value: unknown, context: CircularReferenceContext, pathKey: string): unknown {
    // Handle primitives and null/undefined early
    if (!value || typeof value !== 'object') {
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item) && !this.isSpecialObjectType(item)) {
          const itemPath = pathKey ? `${pathKey}.${index}` : index.toString();
          return this.processObjectWithContext(item as Record<string, unknown>, context, itemPath);
        }
        return item;
      });
    }

    // Handle objects (preserve special types)
    if (this.isSpecialObjectType(value)) {
      return value;
    }

    return this.processObjectWithContext(value as Record<string, unknown>, context, pathKey);
  }

  private isSpecialObjectType(value: unknown): boolean {
    return (
      value instanceof Date ||
      value instanceof RegExp ||
      value instanceof Error ||
      value instanceof Map ||
      value instanceof Set ||
      value instanceof WeakMap ||
      value instanceof WeakSet ||
      value instanceof Promise ||
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value) ||
      typeof value === 'function'
    );
  }

  clearPathCache(): void {
    this.pathCache.clear();
  }

  getPathCacheSize(): number {
    return this.pathCache.size;
  }

  /**
   * Evicts oldest entries when cache exceeds maxCacheSize
   */
  private evictCacheIfNeeded(): void {
    if (this.pathCache.size >= CircularReferenceDetectorService.maxCacheSize) {
      // Remove first 100 entries (FIFO)
      const keysToRemove = Array.from(this.pathCache.keys()).slice(0, 100);
      keysToRemove.forEach((key) => this.pathCache.delete(key));
    }
  }
}
