import { PluginLoadResult, PluginManifest, PluginLoadOptions } from './plugin-strict-interfaces';

/**
 * Strategy pattern interface for plugin loading implementations
 */
export interface PluginLoaderStrategy {
  readonly name: string;
  readonly priority: number;
  canLoad(manifest: PluginManifest): boolean;
  load(manifest: PluginManifest, options?: PluginLoadOptions): Promise<PluginLoadResult>;
  unload(pluginId: string): Promise<boolean>;
  supports(type: string): boolean;
  validate?(manifest: PluginManifest): Promise<boolean>;
}