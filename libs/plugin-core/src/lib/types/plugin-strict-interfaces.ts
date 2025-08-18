/**
 * Semantic version information for plugins
 */
export interface IPluginVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

/**
 * Base plugin metadata
 */
export interface IPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author: string;
  license: string;
  keywords?: string[];
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Guard scope definitions
 */
export type GuardScope = 'local' | 'external' | 'global';

/**
 * Base interface for all guard entries
 */
export interface BaseGuardEntry {
  name: string;
  description?: string;
  source: string;
  scope: GuardScope;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Local guard entry (defined within the plugin)
 */
export interface LocalGuardEntry extends BaseGuardEntry {
  scope: 'local';
  class: string;
  dependencies?: string[];
  exported?: boolean;
}

/**
 * External guard entry (imported from another plugin or module)
 */
export interface ExternalGuardEntry extends BaseGuardEntry {
  scope: 'external';
  module: string;
  importPath?: string;
}

/**
 * Global guard entry (system-wide guards)
 */
export interface GlobalGuardEntry extends BaseGuardEntry {
  scope: 'global';
  systemLevel: boolean;
}

/**
 * Union type for all guard entry types
 */
export type GuardEntry = LocalGuardEntry | ExternalGuardEntry | GlobalGuardEntry;

/**
 * Configuration for cross-plugin service sharing
 */
export interface CrossPluginServiceConfig {
  serviceName: string;
  token: string;
  source: string;
}

/**
 * Security configuration for plugins
 */
export interface PluginSecurity {
  trustLevel: 'internal' | 'verified' | 'community';
  signature?: {
    algorithm: string;
    publicKey: string;
    signature: string;
  };
  checksum?: {
    algorithm: string;
    hash: string;
  };
  sandbox?: {
    enabled: boolean;
    isolationLevel?: 'process' | 'vm' | 'container';
    resourceLimits?: {
      maxMemory?: number;
      maxCPU?: number;
      maxFileSize?: number;
      maxNetworkBandwidth?: number;
    };
  };
  fileAccess?: FileAccessPermissions;
}

/**
 * File access permissions for plugins
 */
export interface FileAccessPermissions {
  allowedExtensions?: string[];
  maxFileSize?: number;
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canList?: boolean;
}
/**
 * Plugin module metadata defining NestJS components
 */
export interface PluginModuleMeta {
  controllers?: string[];
  providers?: string[];
  exports?: string[];
  imports?: string[];
  guards?: GuardEntry[];
  interceptors?: string[];
  pipes?: string[];
  middleware?: string[];
  crossPluginServices?: CrossPluginServiceConfig[];
}

/**
 * Plugin compatibility requirements
 */
export interface PluginCompatibility {
  minimumHostVersion?: string;
  maximumHostVersion?: string;
  nodeVersion: string;
  nestVersion?: string;
  platformSupport?: ('darwin' | 'linux' | 'win32')[];
}

/**
 * Plugin permission configuration
 */
export interface PluginPermissions {
  services?: string[];
  modules?: string[];
  fileSystem?: string[];
  network?: string[];
  system?: string[];
}

/**
 * Complete plugin manifest containing all plugin configuration
 */
export interface PluginManifest extends IPlugin {
  loadOrder?: number;
  critical?: boolean;
  entryPoint: string;
  exports?: string[];
  permissions?: PluginPermissions;
  module: PluginModuleMeta;
  security?: PluginSecurity;
  compatibility?: PluginCompatibility;
}

/**
 * Methods that a plugin instance can implement for lifecycle management
 */
export interface PluginInstanceMethods {
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
  healthCheck?(): Promise<boolean> | boolean;
  configure?(config: Record<string, unknown>): Promise<void> | void;
  getMetrics?(): Promise<Record<string, unknown>> | Record<string, unknown>;
}

/**
 * Runtime representation of a loaded plugin
 */
export interface PluginInstance {
  plugin: IPlugin;
  instance: PluginInstanceMethods | unknown;
  state: PluginState;
  metadata: PluginMetadata;
  moduleRef?: unknown;
}

/**
 * Runtime metadata for a plugin instance
 */
export interface PluginMetadata {
  loadedAt: Date;
  loadTime: number;
  memoryUsage?: number;
  dependencies: PluginInstance[];
  buildInfo?: {
    builtAt?: Date;
    compiler?: string;
    sourceHash?: string;
  };
  performance?: {
    startupTime?: number;
    avgResponseTime?: number;
    errorCount?: number;
  };
}

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  UNLOADING = 'unloading',
  FAILED = 'failed',
}

/**
 * Result of plugin loading operation
 */
export interface PluginLoadResult {
  success: boolean;
  plugin?: PluginInstance;
  error?: Error;
  warnings?: string[];
  duration?: number;
  retryCount?: number;
}

/**
 * Security context for plugin execution
 */
export interface PluginSecurityContext {
  permissions: string[];
  sandboxed: boolean;
  resourceLimits: ResourceLimits;
  trustLevel?: 'internal' | 'verified' | 'community';
  isolationLevel?: 'none' | 'minimal' | 'strict';
}

/**
 * Resource limits for plugin execution
 */
export interface ResourceLimits {
  maxMemory?: number;
  maxCpuTime?: number;
  maxFileDescriptors?: number;
  maxNetworkConnections?: number;
  maxDiskSpace?: number;
  timeoutMs?: number;
}

/**
 * Options for plugin loading operations
 */
export interface PluginLoadOptions {
  timeout?: number;
  retries?: number;
  security?: PluginSecurityContext;
  parallel?: boolean;
  skipDependencies?: boolean;
  enableHotReload?: boolean;
  validateManifest?: boolean;
  cacheStrategy?: 'none' | 'memory' | 'disk' | 'hybrid';
}
