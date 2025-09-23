import { Injectable, Logger } from '@nestjs/common';
import { EnhancedPluginRegistryEntry } from '../types';

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly loadedPlugins = new Map<string, EnhancedPluginRegistryEntry>();

  /**
   * Register a plugin in the registry
   */
  register(pluginName: string, entry: EnhancedPluginRegistryEntry): void {
    if (this.loadedPlugins.has(pluginName)) {
      this.logger.warn(`Plugin ${pluginName} is already registered, overwriting`);
    }

    this.loadedPlugins.set(pluginName, entry);
    this.logger.debug(`Plugin registered: ${pluginName}`);
  }

  /**
   * Get a plugin entry by name
   */
  get(pluginName: string): EnhancedPluginRegistryEntry | undefined {
    return this.loadedPlugins.get(pluginName);
  }

  /**
   * Get plugin instance by name
   */
  getInstance(pluginName: string): any | undefined {
    return this.loadedPlugins.get(pluginName)?.instance;
  }

  /**
   * Get all loaded plugin names
   */
  getPluginNames(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  /**
   * Get all plugin entries
   */
  getAll(): EnhancedPluginRegistryEntry[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginName: string): boolean {
    return this.loadedPlugins.has(pluginName);
  }

  /**
   * Update plugin status
   */
  updateStatus(pluginName: string, status: 'active' | 'inactive' | 'error'): boolean {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.status = status;
      this.logger.debug(`Plugin ${pluginName} status updated to: ${status}`);
      return true;
    }
    return false;
  }

  /**
   * Update plugin activity timestamp
   */
  updateActivity(pluginName: string): void {
    const plugin = this.loadedPlugins.get(pluginName);
    if (plugin) {
      plugin.lastActivity = new Date();
      if (plugin.metrics) {
        plugin.metrics.requestCount++;
      }
    }
  }

  /**
   * Remove a plugin from the registry
   */
  remove(pluginName: string): boolean {
    const success = this.loadedPlugins.delete(pluginName);
    if (success) {
      this.logger.debug(`Plugin removed from registry: ${pluginName}`);
    }
    return success;
  }

  /**
   * Clear all plugins from the registry
   */
  clear(): void {
    this.loadedPlugins.clear();
    this.logger.debug('Plugin registry cleared');
  }

  /**
   * Get registry size
   */
  size(): number {
    return this.loadedPlugins.size;
  }

  /**
   * Get plugins filtered by status
   */
  getByStatus(status: 'active' | 'inactive' | 'error'): EnhancedPluginRegistryEntry[] {
    return this.getAll().filter((plugin) => plugin.status === status);
  }
}
