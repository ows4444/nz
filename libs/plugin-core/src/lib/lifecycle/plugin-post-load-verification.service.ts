import { Injectable, Logger } from '@nestjs/common';
import { PluginInstance, PluginInstanceMethods } from '../types/plugin-strict-interfaces';

@Injectable()
export class PluginPostLoadVerificationService {
  private readonly logger = new Logger(PluginPostLoadVerificationService.name);

  async verifyPlugin(pluginInstance: PluginInstance): Promise<VerificationResult> {
    this.logger.log(`Verifying plugin ${pluginInstance.plugin.id}`);

    const result: VerificationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    try {
      // Verify plugin structure
      this.verifyPluginStructure(pluginInstance, result);

      // Verify plugin interface
      this.verifyPluginInterface(pluginInstance, result);

      // Verify dependencies
      await this.verifyDependencies(pluginInstance, result);

      // Run health check if available
      await this.runHealthCheck(pluginInstance, result);

      // Verify permissions
      this.verifyPermissions(pluginInstance, result);

      if (result.errors.length > 0) {
        result.success = false;
        this.logger.error(`Plugin ${pluginInstance.plugin.id} verification failed`, result.errors);
      } else if (result.warnings.length > 0) {
        this.logger.warn(`Plugin ${pluginInstance.plugin.id} verification completed with warnings`, result.warnings);
      } else {
        this.logger.log(`Plugin ${pluginInstance.plugin.id} verification passed`);
      }

    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Verification error: ${errorMessage}`);
      this.logger.error(`Plugin ${pluginInstance.plugin.id} verification failed`, error);
    }

    return result;
  }

  private verifyPluginStructure(pluginInstance: PluginInstance, result: VerificationResult): void {
    if (!pluginInstance.plugin) {
      result.errors.push('Plugin metadata is missing');
      return;
    }

    if (!pluginInstance.plugin.id) {
      result.errors.push('Plugin ID is missing');
    }

    if (!pluginInstance.plugin.name) {
      result.errors.push('Plugin name is missing');
    }

    if (!pluginInstance.plugin.version) {
      result.errors.push('Plugin version is missing');
    }

    if (!pluginInstance.instance) {
      result.errors.push('Plugin instance is missing');
    }
  }

  private verifyPluginInterface(pluginInstance: PluginInstance, result: VerificationResult): void {
    const instance = pluginInstance.instance;
    if (!instance) return;

    // Type guard to check if instance has plugin methods
    if (this.isPluginInstanceMethods(instance)) {
      // Check for standard lifecycle methods
      const lifecycleMethods: (keyof PluginInstanceMethods)[] = ['start', 'stop', 'destroy'];
      for (const method of lifecycleMethods) {
        if (instance[method] && typeof instance[method] !== 'function') {
          result.warnings.push(`Plugin has non-function ${method} property`);
        }
      }

      // Check for health check method
      if (instance.healthCheck && typeof instance.healthCheck !== 'function') {
        result.warnings.push('Plugin has non-function healthCheck property');
      }
    }
  }

  private isPluginInstanceMethods(instance: unknown): instance is PluginInstanceMethods {
    return typeof instance === 'object' && instance !== null;
  }

  private async verifyDependencies(pluginInstance: PluginInstance, result: VerificationResult): Promise<void> {
    const dependencies = pluginInstance.plugin.dependencies || [];
    
    for (const dependency of dependencies) {
      // Check if dependency is available
      const dependencyInstance = pluginInstance.metadata.dependencies.find(
        dep => dep.plugin.id === dependency
      );

      if (!dependencyInstance) {
        result.errors.push(`Required dependency not found: ${dependency}`);
      }
    }
  }

  private async runHealthCheck(pluginInstance: PluginInstance, result: VerificationResult): Promise<void> {
    const instance = pluginInstance.instance;
    if (!this.isPluginInstanceMethods(instance) || typeof instance.healthCheck !== 'function') {
      return;
    }

    try {
      const healthResult = await Promise.race([
        instance.healthCheck(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);

      if (!healthResult) {
        result.warnings.push('Plugin health check failed or returned unhealthy status');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.warnings.push(`Plugin health check error: ${errorMessage}`);
    }
  }

  private verifyPermissions(pluginInstance: PluginInstance, result: VerificationResult): void {
    // This would integrate with the security manager to verify permissions
    // For now, just a placeholder
    if (pluginInstance.plugin.metadata?.permissions) {
      const permissions = pluginInstance.plugin.metadata.permissions;
      if (Array.isArray(permissions) && permissions.length > 0) {
        result.warnings.push('Plugin requests special permissions - review required');
      }
    }
  }
}

export interface VerificationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}