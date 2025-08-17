# Plugin System Interfaces

## Overview

This document describes the core interfaces and types used throughout the Nizaami plugin system.

## Location

`libs/plugin-core/src/lib/interfaces/plugin-strict-interfaces.ts`

## Core Interfaces

### Plugin

Represents basic plugin metadata.

```typescript
interface Plugin {
  id: string;                    // Unique plugin identifier
  name: string;                  // Human-readable plugin name
  version: string;               // Semantic version string
  description?: string;          // Optional description
  dependencies?: string[];       // Array of plugin dependencies
  metadata?: Record<string, any>; // Additional plugin metadata
}
```

### PluginManifest

Complete plugin manifest structure used for loading.

```typescript
interface PluginManifest {
  plugin: Plugin;        // Core plugin information
  entryPoint: string;    // Path to plugin entry point file
  exports?: string[];    // Array of exported service names
  permissions?: string[]; // Required permissions
}
```

### PluginInstance

Represents a loaded plugin instance with runtime information.

```typescript
interface PluginInstance {
  plugin: Plugin;           // Plugin metadata
  instance: any;            // Actual plugin instance/module
  state: PluginState;       // Current plugin state
  metadata: PluginMetadata; // Runtime metadata
}
```

### PluginMetadata

Runtime metadata for loaded plugins.

```typescript
interface PluginMetadata {
  loadedAt: Date;                    // When plugin was loaded
  loadTime: number;                  // Loading duration in milliseconds
  memoryUsage?: number;              // Current memory usage in bytes
  dependencies: PluginInstance[];    // Loaded dependency instances
}
```

## Plugin States

### PluginState Enum

```typescript
enum PluginState {
  UNLOADED = 'unloaded',     // Plugin not loaded
  LOADING = 'loading',       // Plugin currently being loaded
  LOADED = 'loaded',         // Plugin loaded but not running
  RUNNING = 'running',       // Plugin active and running
  STOPPED = 'stopped',       // Plugin stopped but still loaded
  ERROR = 'error',           // Plugin in error state
  UNLOADING = 'unloading'    // Plugin being unloaded
}
```

### State Transitions

Valid state transitions:

- `UNLOADED` → `LOADING` → `LOADED` → `RUNNING`
- `RUNNING` → `STOPPED`
- `STOPPED` → `RUNNING`
- Any state → `ERROR`
- Any state → `UNLOADING` → `UNLOADED`

## Loading and Results

### PluginLoadResult

Result of plugin loading operations.

```typescript
interface PluginLoadResult {
  success: boolean;           // Whether loading succeeded
  plugin?: PluginInstance;    // Loaded plugin instance (if successful)
  error?: Error;              // Error details (if failed)
  warnings?: string[];        // Non-fatal warnings
}
```

### PluginLoadOptions

Options for controlling plugin loading behavior.

```typescript
interface PluginLoadOptions {
  timeout?: number;                    // Loading timeout in milliseconds
  retries?: number;                    // Number of retry attempts
  security?: PluginSecurityContext;    // Security context
  parallel?: boolean;                  // Enable parallel loading
}
```

## Security Interfaces

### PluginSecurityContext

Security context for plugin execution.

```typescript
interface PluginSecurityContext {
  permissions: string[];              // Granted permissions
  sandboxed: boolean;                 // Whether plugin is sandboxed
  resourceLimits: ResourceLimits;     // Resource constraints
}
```

### ResourceLimits

Resource constraints for plugin execution.

```typescript
interface ResourceLimits {
  maxMemory?: number;         // Maximum memory usage in bytes
  maxCpuTime?: number;        // Maximum CPU time in milliseconds
  maxFileDescriptors?: number; // Maximum file descriptors
}
```

## Configuration Interfaces

### PluginCoreConfig

Main configuration for the plugin system.

```typescript
interface PluginCoreConfig {
  searchPaths?: string[];                    // Plugin search directories
  autoStart?: boolean;                       // Auto-start plugins after loading
  enableMemoryMonitoring?: boolean;          // Enable memory monitoring
  defaultTimeout?: number;                   // Default loading timeout
  defaultRetries?: number;                   // Default retry attempts
  parallelLoading?: boolean;                 // Enable parallel loading
  securityConfig?: PluginSecurityConfig;     // Security configuration
  resourceLimits?: DefaultResourceLimits;    // Default resource limits
}
```

### PluginSecurityConfig

Security-specific configuration.

```typescript
interface PluginSecurityConfig {
  enableSandboxing?: boolean;    // Enable plugin sandboxing
  defaultPermissions?: string[]; // Default permissions for plugins
  trustedPlugins?: string[];     // List of trusted plugin IDs
}
```

### DefaultResourceLimits

Default resource limits for plugins.

```typescript
interface DefaultResourceLimits {
  maxMemory?: number;         // Default memory limit
  maxCpuTime?: number;        // Default CPU time limit
  maxFileDescriptors?: number; // Default file descriptor limit
}
```

## Async Configuration Interfaces

### PluginCoreAsyncConfig

Configuration for async plugin core setup.

```typescript
interface PluginCoreAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<PluginCoreOptionsFactory>;
  useClass?: Type<PluginCoreOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PluginCoreConfig> | PluginCoreConfig;
  inject?: any[];
}
```

### PluginCoreOptionsFactory

Factory interface for creating plugin core options.

```typescript
interface PluginCoreOptionsFactory {
  createPluginCoreOptions(): Promise<PluginCoreConfig> | PluginCoreConfig;
}
```

## Feature Configuration

### PluginFeatureConfig

Configuration for plugin features.

```typescript
interface PluginFeatureConfig {
  name: string;                        // Feature name
  searchPaths?: string[];              // Feature-specific search paths
  autoLoad?: boolean;                  // Auto-load feature plugins
  config?: Partial<PluginCoreConfig>;  // Feature-specific config overrides
}
```

### PluginFeatureAsyncConfig

Async configuration for plugin features.

```typescript
interface PluginFeatureAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  name: string;
  useExisting?: Type<PluginFeatureOptionsFactory>;
  useClass?: Type<PluginFeatureOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PluginFeatureConfig> | PluginFeatureConfig;
  inject?: any[];
}
```

### PluginFeatureOptionsFactory

Factory interface for creating plugin feature options.

```typescript
interface PluginFeatureOptionsFactory {
  createPluginFeatureOptions(): Promise<PluginFeatureConfig> | PluginFeatureConfig;
}
```

## Constants

### Configuration Tokens

```typescript
const PLUGIN_CORE_CONFIG = Symbol('PLUGIN_CORE_CONFIG');
const PLUGIN_FEATURE_CONFIG = Symbol('PLUGIN_FEATURE_CONFIG');
```

These symbols are used for dependency injection of configuration objects.

## Usage Examples

### Basic Plugin Loading

```typescript
const loadOptions: PluginLoadOptions = {
  timeout: 30000,
  retries: 3,
  parallel: true,
  security: {
    permissions: ['file:read', 'network:http'],
    sandboxed: true,
    resourceLimits: {
      maxMemory: 100 * 1024 * 1024, // 100MB
      maxCpuTime: 5000 // 5 seconds
    }
  }
};
```

### Configuration Setup

```typescript
const config: PluginCoreConfig = {
  searchPaths: ['./plugins', './custom-plugins'],
  autoStart: true,
  enableMemoryMonitoring: true,
  defaultTimeout: 30000,
  defaultRetries: 3,
  parallelLoading: true,
  securityConfig: {
    enableSandboxing: true,
    defaultPermissions: ['file:read'],
    trustedPlugins: ['core-plugin', 'admin-plugin']
  },
  resourceLimits: {
    maxMemory: 50 * 1024 * 1024, // 50MB default
    maxCpuTime: 3000
  }
};
```

### State Checking

```typescript
function handlePluginState(plugin: PluginInstance) {
  switch (plugin.state) {
    case PluginState.RUNNING:
      console.log(`Plugin ${plugin.plugin.name} is running`);
      break;
    case PluginState.ERROR:
      console.error(`Plugin ${plugin.plugin.name} has errors`);
      break;
    case PluginState.STOPPED:
      console.log(`Plugin ${plugin.plugin.name} is stopped`);
      break;
    default:
      console.log(`Plugin ${plugin.plugin.name} state: ${plugin.state}`);
  }
}
```
