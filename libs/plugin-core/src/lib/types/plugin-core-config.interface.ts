import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Core configuration for the plugin system
 */
export interface PluginCoreConfig {
  searchPaths?: string[];
  autoStart?: boolean;
  enableMemoryMonitoring?: boolean;
  defaultTimeout?: number;
  defaultRetries?: number;
  parallelLoading?: boolean;
  maxConcurrentLoads?: number;
  enableHotReload?: boolean;
  cacheEnabled?: boolean;
  skipRuntimeLoading?: boolean;
  securityConfig?: PluginSecurityConfig;
  resourceLimits?: DefaultResourceLimits;
  logging?: PluginLoggingConfig;
}

/**
 * Security configuration for plugins
 */
export interface PluginSecurityConfig {
  enableSandboxing?: boolean;
  defaultPermissions?: string[];
  trustedPlugins?: string[];
  allowedSources?: string[];
  requireSignature?: boolean;
  isolationLevel?: 'none' | 'minimal' | 'strict';
}

/**
 * Default resource limits for all plugins
 */
export interface DefaultResourceLimits {
  maxMemory?: number;
  maxCpuTime?: number;
  maxFileDescriptors?: number;
  maxNetworkConnections?: number;
  maxDiskSpace?: number;
}

/**
 * Logging configuration for plugins
 */
export interface PluginLoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics?: boolean;
  enableTracing?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
}

/**
 * Async configuration for plugin core module
 */
export interface PluginCoreAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<PluginCoreOptionsFactory>;
  useClass?: Type<PluginCoreOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PluginCoreConfig> | PluginCoreConfig;
  inject?: any[];
}

/**
 * Factory interface for creating plugin core options
 */
export interface PluginCoreOptionsFactory {
  createPluginCoreOptions(): Promise<PluginCoreConfig> | PluginCoreConfig;
}

/**
 * Configuration for plugin features
 */
export interface PluginFeatureConfig {
  name: string;
  searchPaths?: string[];
  autoLoad?: boolean;
  loadOrder?: number;
  dependencies?: string[];
  config?: Partial<PluginCoreConfig>;
}

/**
 * Async configuration for plugin features
 */
export interface PluginFeatureAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  name: string;
  useExisting?: Type<PluginFeatureOptionsFactory>;
  useClass?: Type<PluginFeatureOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PluginFeatureConfig> | PluginFeatureConfig;
  inject?: any[];
}

/**
 * Factory interface for creating plugin feature options
 */
export interface PluginFeatureOptionsFactory {
  createPluginFeatureOptions(): Promise<PluginFeatureConfig> | PluginFeatureConfig;
}

export const PLUGIN_CORE_CONFIG = Symbol('PLUGIN_CORE_CONFIG');
export const PLUGIN_FEATURE_CONFIG = Symbol('PLUGIN_FEATURE_CONFIG');