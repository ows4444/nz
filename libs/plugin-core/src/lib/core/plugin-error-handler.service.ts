import { Logger } from '@nestjs/common';

export enum PluginErrorCode {
  MANIFEST_NOT_FOUND = 'MANIFEST_NOT_FOUND',
  MANIFEST_INVALID = 'MANIFEST_INVALID',
  DIST_NOT_FOUND = 'DIST_NOT_FOUND',
  COMPONENT_NOT_FOUND = 'COMPONENT_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  LOADING_FAILED = 'LOADING_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

export interface PluginError {
  code: PluginErrorCode;
  message: string;
  pluginName?: string;
  component?: string;
  details?: any;
}

export class PluginErrorHandler {
  private static readonly logger = new Logger(PluginErrorHandler.name);
  private static readonly errors: Map<string, PluginError[]> = new Map();

  static createError(code: PluginErrorCode, message: string, pluginName?: string, component?: string, details?: any): PluginError {
    return {
      code,
      message,
      pluginName,
      component,
      details,
    };
  }

  static handleError(error: PluginError): void {
    const errorKey = error.pluginName || 'system';

    if (!this.errors.has(errorKey)) {
      this.errors.set(errorKey, []);
    }

    this.errors.get(errorKey)!.push(error);

    // Log based on severity
    switch (error.code) {
      case PluginErrorCode.MANIFEST_NOT_FOUND:
      case PluginErrorCode.DIST_NOT_FOUND:
        this.logger.debug(`${error.code}: ${error.message}`, error.details);
        break;

      case PluginErrorCode.MANIFEST_INVALID:
      case PluginErrorCode.CONFIG_INVALID:
      case PluginErrorCode.VALIDATION_FAILED:
        this.logger.warn(`${error.code}: ${error.message}`, error.details);
        break;

      case PluginErrorCode.COMPONENT_NOT_FOUND:
      case PluginErrorCode.LOADING_FAILED:
        this.logger.error(`${error.code}: ${error.message}`, error.details);
        break;
    }
  }

  static getErrors(pluginName?: string): PluginError[] {
    if (pluginName) {
      return this.errors.get(pluginName) || [];
    }

    const allErrors: PluginError[] = [];
    this.errors.forEach((errors) => {
      allErrors.push(...errors);
    });
    return allErrors;
  }

  static clearErrors(pluginName?: string): void {
    if (pluginName) {
      this.errors.delete(pluginName);
    } else {
      this.errors.clear();
    }
  }

  static hasErrors(pluginName?: string): boolean {
    if (pluginName) {
      return this.errors.has(pluginName) && this.errors.get(pluginName)!.length > 0;
    }
    return this.errors.size > 0;
  }

  static getErrorSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    this.errors.forEach((errors, pluginName) => {
      summary[pluginName] = errors.length;
    });

    return summary;
  }

  static wrapWithErrorHandling<T>(operation: () => T, errorCode: PluginErrorCode, errorMessage: string, pluginName?: string, component?: string): T | null {
    try {
      return operation();
    } catch (caught) {
      const error = this.createError(errorCode, errorMessage, pluginName, component, caught);
      this.handleError(error);
      return null;
    }
  }

  static async wrapWithErrorHandlingAsync<T>(operation: () => Promise<T>, errorCode: PluginErrorCode, errorMessage: string, pluginName?: string, component?: string): Promise<T | null> {
    try {
      return await operation();
    } catch (caught) {
      const error = this.createError(errorCode, errorMessage, pluginName, component, caught);
      this.handleError(error);
      return null;
    }
  }

  /**
   * Specialized error handling for operations that should return empty arrays on failure
   */
  static wrapDiscoveryOperation<T>(operation: () => T[], errorCode: PluginErrorCode, errorMessage: string, pluginName?: string): T[] {
    return this.wrapWithErrorHandling(operation, errorCode, errorMessage, pluginName) || [];
  }

  /**
   * Specialized error handling for plugin module creation operations
   */
  static wrapModuleCreationOperation<T>(
    operation: () => T,
    errorCode: PluginErrorCode,
    errorMessage: string,
    createFailureResult: (error: string) => any,
    pluginName?: string,
    component?: string
  ): any {
    const result = this.wrapWithErrorHandling(operation, errorCode, errorMessage, pluginName, component);
    
    if (result && (result as any).module) {
      return {
        success: true,
        module: (result as any).module,
        manifest: (result as any).manifest,
        warnings: [],
      };
    }

    return createFailureResult(errorMessage);
  }
}
