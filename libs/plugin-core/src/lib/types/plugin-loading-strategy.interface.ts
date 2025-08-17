import { PluginManifest, PluginLoadResult, PluginLoadOptions } from './plugin-strict-interfaces';

/**
 * Strategy interface for plugin loading approaches (parallel, sequential, etc.)
 */
export interface PluginLoadingStrategy {
  readonly name: string;
  readonly description: string;
  readonly maxConcurrency?: number;
  loadPlugins(manifests: PluginManifest[], options?: PluginLoadOptions): Promise<PluginLoadResult[]>;
  getName(): string;
  getDescription(): string;
  canHandle(manifests: PluginManifest[]): boolean;
  estimateLoadTime?(manifests: PluginManifest[]): number;
}