/**
 * Enhanced types for plugin modules and discovery
 */

import { Type } from '@nestjs/common';
import { PluginManifest } from './plugin-strict-interfaces';

/**
 * Represents a discovered plugin module ready for loading
 */
export interface DiscoveredPluginModule {
  module: Type<any>;
  manifest: PluginManifest;
  path: string;
  name: string;
}

/**
 * Plugin discovery result containing modules and metadata
 */
export interface PluginDiscoveryResult {
  modules: DiscoveredPluginModule[];
  totalDiscovered: number;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced plugin registry entry for tracking loaded plugins with extended metadata
 */
export interface EnhancedPluginRegistryEntry {
  name: string;
  instance: any;
  module: Type<any>;
  manifest: PluginManifest;
  registeredAt: Date;
  status: 'active' | 'inactive' | 'error';
  lastActivity?: Date;
  metrics?: {
    loadTime: number;
    memoryUsage: number;
    requestCount: number;
  };
}

/**
 * Plugin statistics and metrics
 */
export interface PluginStatistics {
  totalRegistered: number;
  activePlugins: number;
  inactivePlugins: number;
  errorPlugins: number;
  pluginNames: string[];
  loadTime: number;
  memoryUsage?: number;
}

/**
 * Plugin discovery options for fine-tuning the discovery process
 */
export interface PluginDiscoveryOptions {
  parallel?: boolean;
  maxConcurrency?: number;
  includeInactive?: boolean;
  validateManifests?: boolean;
  skipErrors?: boolean;
}

/**
 * Result of plugin module creation
 */
export interface PluginModuleCreationResult {
  success: boolean;
  module?: Type<any>;
  error?: string;
  warnings?: string[];
  manifest?: PluginManifest;
}
