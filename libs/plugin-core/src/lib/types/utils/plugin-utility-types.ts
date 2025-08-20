/**
 * Utility types for the plugin system
 */

import { PluginState, PluginManifest, PluginInstance } from '../core/plugin-strict-interfaces';

/**
 * Plugin event types
 */
export type PluginEventType =
  | 'plugin:loading'
  | 'plugin:loaded'
  | 'plugin:starting'
  | 'plugin:started'
  | 'plugin:stopping'
  | 'plugin:stopped'
  | 'plugin:error'
  | 'plugin:unloading'
  | 'plugin:unloaded';

/**
 * Plugin event data
 */
export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  error?: Error;
}

/**
 * Plugin registry entry
 */
export interface PluginRegistryEntry {
  manifest: PluginManifest;
  instance?: PluginInstance;
  state: PluginState;
  registeredAt: Date;
  lastActivity?: Date;
}

/**
 * Plugin dependency graph node
 */
export interface PluginDependencyNode {
  pluginId: string;
  dependencies: string[];
  dependents: string[];
  loadOrder: number;
}

/**
 * Plugin health status
 */
export interface PluginHealthStatus {
  pluginId: string;
  healthy: boolean;
  lastCheck: Date;
  metrics?: {
    responseTime: number;
    memoryUsage: number;
    errorRate: number;
  };
  issues?: string[];
}

/**
 * Plugin build information
 */
export interface PluginBuildInfo {
  buildTime: Date;
  compiler: string;
  sourceHash: string;
  environment: 'development' | 'production';
  optimized: boolean;
}

/**
 * Plugin manifest validation result
 */
export interface PluginManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: PluginManifest;
}

/**
 * Plugin runtime context
 */
export interface PluginRuntimeContext {
  searchPaths: string[];
  loadedPlugins: Map<string, PluginInstance>;
  dependencyGraph: Map<string, PluginDependencyNode>;
  eventEmitter?: NodeJS.EventEmitter;
}

/**
 * Utility types for plugin operations
 */
export type PluginId = string;
export type PluginName = string;

/**
 * Plugin filter function type
 */
export type PluginFilter = (plugin: PluginManifest | PluginInstance) => boolean;

/**
 * Plugin transformer function type
 */
export type PluginTransformer<T> = (plugin: PluginManifest | PluginInstance) => T;

/**
 * Plugin event handler type
 */
export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>;

/**
 * Plugin hook types
 */
export interface PluginHooks {
  beforeLoad?: (manifest: PluginManifest) => Promise<void> | void;
  afterLoad?: (instance: PluginInstance) => Promise<void> | void;
  beforeUnload?: (pluginId: string) => Promise<void> | void;
  afterUnload?: (pluginId: string) => Promise<void> | void;
  onError?: (error: Error, pluginId?: string) => Promise<void> | void;
}

/**
 * Plugin configuration override
 */
export interface PluginConfigOverride {
  pluginId: string;
  config: Record<string, unknown>;
  environment?: string;
  priority?: number;
}

/**
 * Plugin service reference
 */
export interface PluginServiceReference<T = PluginInstance> {
  serviceName: string;
  pluginId: string;
  instance: T;
  version: string;
  exported: boolean;
}
