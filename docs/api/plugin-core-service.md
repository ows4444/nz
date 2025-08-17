# PluginCore Service API

## Overview

The `PluginCore` service is the main entry point for plugin management in the Nizaami system. It provides high-level methods for discovering, loading, and managing plugins throughout their lifecycle.

## Location

`libs/plugin-core/src/lib/plugin-core.service.ts`

## Class Declaration

```typescript
@Injectable()
export class PluginCore implements OnModuleInit, OnModuleDestroy
```

## Constructor

```typescript
constructor(
  private readonly discoveryService: PluginDiscoveryService,
  private readonly coordinatorService: PluginLoaderCoordinatorService,
  private readonly orchestratorService: PluginOrchestratorService,
  private readonly memoryManagerService: PluginMemoryManagerService,
  private readonly loaderService: PluginLoaderService,
  private readonly defaultStrategy: DefaultPluginLoaderStrategy,
  @Optional() @Inject(PLUGIN_CORE_CONFIG) private readonly config: PluginCoreConfig = {}
)
```

## Lifecycle Methods

### onModuleInit()

```typescript
async onModuleInit(): Promise<void>
```

Initializes the plugin core service during NestJS module initialization:

- Registers default plugin loader strategy
- Starts memory monitoring if enabled
- Sets up orchestrator state change listeners
- Auto-discovers and loads plugins if search paths are configured

### onModuleDestroy()

```typescript
async onModuleDestroy(): Promise<void>
```

Cleans up resources during module destruction:

- Unloads all plugins
- Stops memory monitoring

## Plugin Discovery and Loading

### discoverAndLoadPlugins()

```typescript
async discoverAndLoadPlugins(searchPaths: string[]): Promise<PluginLoadResult[]>
```

Discovers and loads plugins from specified search paths.

**Parameters:**

- `searchPaths`: Array of directory paths to search for plugins

**Returns:**

- `Promise<PluginLoadResult[]>`: Array of load results for each plugin

**Behavior:**

- Discovers plugins using `PluginDiscoveryService`
- Loads plugins with configured options (timeout, retries, parallel loading)
- Auto-starts plugins if `autoStart` is enabled
- Handles errors gracefully and logs results

### discoverPluginsOnly()

```typescript
async discoverPluginsOnly(searchPaths: string[]): Promise<PluginManifest[]>
```

Discovers plugins without loading them.

**Parameters:**

- `searchPaths`: Array of directory paths to search

**Returns:**

- `Promise<PluginManifest[]>`: Array of discovered plugin manifests

## Individual Plugin Management

### loadPlugin()

```typescript
async loadPlugin(manifest: PluginManifest): Promise<PluginLoadResult>
```

Loads a single plugin from its manifest.

**Parameters:**

- `manifest`: Plugin manifest containing metadata and configuration

**Returns:**

- `Promise<PluginLoadResult>`: Load result with success status and optional plugin instance

**Behavior:**

- Uses configured load options (timeout, retries, parallel loading)
- Auto-starts plugin if `autoStart` is enabled
- Handles loading errors and returns appropriate result

### unloadPlugin()

```typescript
async unloadPlugin(pluginId: string): Promise<boolean>
```

Unloads a specific plugin.

**Parameters:**

- `pluginId`: Unique identifier of the plugin to unload

**Returns:**

- `Promise<boolean>`: `true` if unload was successful, `false` otherwise

**Behavior:**

- Stops the plugin before unloading
- Removes plugin from memory
- Handles errors gracefully

### restartPlugin()

```typescript
async restartPlugin(pluginId: string): Promise<boolean>
```

Restarts a plugin by stopping and starting it.

**Parameters:**

- `pluginId`: Unique identifier of the plugin to restart

**Returns:**

- `Promise<boolean>`: `true` if restart was successful, `false` otherwise

## Plugin State and Information

### getLoadedPlugins()

```typescript
getLoadedPlugins(): string[]
```

Gets list of currently loaded plugin IDs.

**Returns:**

- `string[]`: Array of loaded plugin identifiers

### getPluginState()

```typescript
getPluginState(pluginId: string): PluginState
```

Gets the current state of a specific plugin.

**Parameters:**

- `pluginId`: Plugin identifier

**Returns:**

- `PluginState`: Current state (UNLOADED, LOADING, LOADED, RUNNING, STOPPED, ERROR, UNLOADING)

### getAllPluginStates()

```typescript
getAllPluginStates(): Map<string, PluginState>
```

Gets states of all plugins.

**Returns:**

- `Map<string, PluginState>`: Map of plugin IDs to their current states

### isPluginLoaded()

```typescript
isPluginLoaded(pluginId: string): boolean
```

Checks if a plugin is currently loaded.

**Parameters:**

- `pluginId`: Plugin identifier

**Returns:**

- `boolean`: `true` if plugin is loaded, `false` otherwise

## System Information

### getMemoryReport()

```typescript
getMemoryReport()
```

Gets current memory usage report from the memory manager.

**Returns:**

- Memory usage statistics and plugin-specific memory consumption

### getConfiguration()

```typescript
getConfiguration(): PluginCoreConfig
```

Gets a copy of the current plugin core configuration.

**Returns:**

- `PluginCoreConfig`: Copy of current configuration object

## Configuration Options

The service behavior is controlled by the injected `PluginCoreConfig`:

```typescript
interface PluginCoreConfig {
  searchPaths?: string[];              // Paths to search for plugins
  autoStart?: boolean;                 // Auto-start plugins after loading
  enableMemoryMonitoring?: boolean;    // Enable memory monitoring
  defaultTimeout?: number;             // Default loading timeout (ms)
  defaultRetries?: number;             // Default retry attempts
  parallelLoading?: boolean;           // Enable parallel plugin loading
  securityConfig?: PluginSecurityConfig;
  resourceLimits?: DefaultResourceLimits;
}
```

## Error Handling

All methods include comprehensive error handling:

- Errors are logged with appropriate context
- Failed operations return appropriate error results
- System continues operating even if individual plugins fail
- Detailed error information is preserved in load results

## Usage Examples

### Basic Plugin Discovery and Loading

```typescript
@Injectable()
export class MyService {
  constructor(private pluginCore: PluginCore) {}

  async initializePlugins() {
    const results = await this.pluginCore.discoverAndLoadPlugins(['./plugins']);
    const successful = results.filter(r => r.success).length;
    console.log(`Loaded ${successful} plugins successfully`);
  }
}
```

### Manual Plugin Management

```typescript
async managePlugin(pluginId: string) {
  // Check if plugin is loaded
  if (!this.pluginCore.isPluginLoaded(pluginId)) {
    console.log('Plugin not loaded');
    return;
  }

  // Get plugin state
  const state = this.pluginCore.getPluginState(pluginId);
  console.log(`Plugin state: ${state}`);

  // Restart if needed
  if (state === PluginState.ERROR) {
    await this.pluginCore.restartPlugin(pluginId);
  }
}
```

### Memory Monitoring

```typescript
async checkMemoryUsage() {
  const report = this.pluginCore.getMemoryReport();
  console.log('Memory usage:', report);
  
  // Get all plugin states
  const states = this.pluginCore.getAllPluginStates();
  states.forEach((state, pluginId) => {
    console.log(`${pluginId}: ${state}`);
  });
}
```
