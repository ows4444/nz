import { PluginManifest, PluginLoadResult, PluginLoadOptions, PluginInstance } from './plugin-strict-interfaces';

/**
 * Coordinator interface for managing plugin loading operations
 */
export interface PluginLoaderCoordinator {
  loadPlugin(manifest: PluginManifest, options?: PluginLoadOptions): Promise<PluginLoadResult>;
  loadPlugins(manifests: PluginManifest[], options?: PluginLoadOptions): Promise<PluginLoadResult[]>;
  unloadPlugin(pluginId: string): Promise<boolean>;
  unloadAllPlugins(): Promise<boolean>;
  reloadPlugin(pluginId: string): Promise<PluginLoadResult>;
  getLoadedPlugins(): string[];
  getPluginInstance(pluginId: string): PluginInstance | undefined;
  isPluginLoaded(pluginId: string): boolean;
  validateDependencies(manifest: PluginManifest): Promise<boolean>;
  getLoadOrder(): string[];
}