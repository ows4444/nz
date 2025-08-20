import { Injectable, Logger, Type } from '@nestjs/common';
import { EnhancedPluginRegistryEntry } from '../types';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PLUGIN_CONSTANTS } from '../constants';

@Injectable()
export class PluginLifecycleManagerService {
  private readonly logger = new Logger(PluginLifecycleManagerService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly pluginRegistry: PluginRegistryService,
    private readonly pluginLifecycleService: PluginLifecycleService
  ) {}

  /**
   * Register a loaded plugin with enhanced metadata
   */
  async registerPlugin(pluginName: string, pluginInstance: any, module?: Type<any>, manifest?: any): Promise<void> {
    const entry: EnhancedPluginRegistryEntry = {
      name: pluginName,
      instance: pluginInstance,
      module: module as Type<any>,
      manifest,
      registeredAt: new Date(),
      status: 'active',
      lastActivity: new Date(),
      metrics: {
        loadTime: Date.now() - this.startTime,
        memoryUsage: 0,
        requestCount: 0,
      },
    };

    this.pluginRegistry.register(pluginName, entry);
    this.logger.log(`${PLUGIN_CONSTANTS.LOG_MESSAGES.GENERAL.PLUGIN_DISCOVERED}: ${pluginName}`);

    // Emit load lifecycle event
    try {
      await this.pluginLifecycleService.emit('load', {
        pluginName,
        manifest,
        instance: pluginInstance,
        timestamp: new Date(),
        context: { module: module?.name },
      });
    } catch (error) {
      this.logger.error(`Error emitting load event for plugin ${pluginName}:`, error);
    }
  }

  /**
   * Mark a plugin as inactive
   */
  async deactivatePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.pluginRegistry.get(pluginName);
    if (!plugin) {
      return false;
    }

    const success = this.pluginRegistry.updateStatus(pluginName, 'inactive');
    if (success) {
      this.logger.log(`Plugin ${pluginName} deactivated`);

      // Emit disable lifecycle event
      try {
        await this.pluginLifecycleService.emit('disable', {
          pluginName,
          manifest: plugin.manifest,
          instance: plugin.instance,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error(`Error emitting disable event for plugin ${pluginName}:`, error);
      }
    }

    return success;
  }

  /**
   * Mark a plugin as active
   */
  async activatePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.pluginRegistry.get(pluginName);
    if (!plugin) {
      return false;
    }

    const success = this.pluginRegistry.updateStatus(pluginName, 'active');
    if (success) {
      // Update activity timestamp
      this.pluginRegistry.updateActivity(pluginName);
      this.logger.log(`Plugin ${pluginName} activated`);

      // Emit enable lifecycle event
      try {
        await this.pluginLifecycleService.emit('enable', {
          pluginName,
          manifest: plugin.manifest,
          instance: plugin.instance,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error(`Error emitting enable event for plugin ${pluginName}:`, error);
      }
    }

    return success;
  }

  /**
   * Remove and unload a plugin
   */
  async unloadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.pluginRegistry.get(pluginName);
    if (!plugin) {
      return false;
    }

    // Emit unload lifecycle event before removal
    try {
      await this.pluginLifecycleService.emit('unload', {
        pluginName,
        manifest: plugin.manifest,
        instance: plugin.instance,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error emitting unload event for plugin ${pluginName}:`, error);
    }

    const success = this.pluginRegistry.remove(pluginName);
    if (success) {
      this.logger.log(`Plugin ${pluginName} unloaded`);
    }

    return success;
  }

  /**
   * Handle plugin error and emit error event
   */
  async handlePluginError(pluginName: string, error: Error): Promise<void> {
    const plugin = this.pluginRegistry.get(pluginName);
    if (plugin) {
      this.pluginRegistry.updateStatus(pluginName, 'error');
    }

    try {
      await this.pluginLifecycleService.emit('error', {
        pluginName,
        manifest: plugin?.manifest,
        instance: plugin?.instance,
        timestamp: new Date(),
        error,
      });
    } catch (lifecycleError) {
      this.logger.error(`Error emitting error event for plugin ${pluginName}:`, lifecycleError);
    }
  }

  /**
   * Batch activate multiple plugins
   */
  async activatePlugins(pluginNames: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const pluginName of pluginNames) {
      try {
        const result = await this.activatePlugin(pluginName);
        if (result) {
          success.push(pluginName);
        } else {
          failed.push(pluginName);
        }
      } catch (error) {
        this.logger.error(`Failed to activate plugin ${pluginName}:`, error);
        failed.push(pluginName);
      }
    }

    return { success, failed };
  }

  /**
   * Batch deactivate multiple plugins
   */
  async deactivatePlugins(pluginNames: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const pluginName of pluginNames) {
      try {
        const result = await this.deactivatePlugin(pluginName);
        if (result) {
          success.push(pluginName);
        } else {
          failed.push(pluginName);
        }
      } catch (error) {
        this.logger.error(`Failed to deactivate plugin ${pluginName}:`, error);
        failed.push(pluginName);
      }
    }

    return { success, failed };
  }

  /**
   * Update plugin activity timestamp
   */
  updatePluginActivity(pluginName: string): void {
    this.pluginRegistry.updateActivity(pluginName);
  }

  /**
   * Get the lifecycle service for direct access
   */
  getLifecycleService(): PluginLifecycleService {
    return this.pluginLifecycleService;
  }
}