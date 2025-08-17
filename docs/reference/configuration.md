# Configuration Reference

## Overview

This document provides a comprehensive reference for all configuration options available in the Nizaami Plugin System.

## Plugin Core Configuration

### PluginCoreConfig

Main configuration interface for the plugin system.

```typescript
interface PluginCoreConfig {
  searchPaths?: string[];
  autoStart?: boolean;
  enableMemoryMonitoring?: boolean;
  defaultTimeout?: number;
  defaultRetries?: number;
  parallelLoading?: boolean;
  securityConfig?: PluginSecurityConfig;
  resourceLimits?: DefaultResourceLimits;
}
```

### Configuration Options

#### searchPaths

- **Type**: `string[]`
- **Default**: `undefined`
- **Description**: Array of directory paths to search for plugins
- **Example**: `['./plugins', './custom-plugins', '/opt/nizaami/plugins']`

#### autoStart

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Automatically start plugins after successful loading
- **Notes**: When `false`, plugins remain in LOADED state until manually started

#### enableMemoryMonitoring

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable real-time memory monitoring for loaded plugins
- **Notes**: Impacts performance slightly but provides valuable monitoring data

#### defaultTimeout

- **Type**: `number`
- **Default**: `30000` (30 seconds)
- **Description**: Default timeout in milliseconds for plugin loading operations
- **Range**: `1000` - `300000` (1 second to 5 minutes)

#### defaultRetries

- **Type**: `number`
- **Default**: `3`
- **Description**: Default number of retry attempts for failed plugin loads
- **Range**: `0` - `10`

#### parallelLoading

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable parallel loading of plugins when dependencies allow
- **Notes**: Significantly improves startup time with multiple plugins

## Security Configuration

### PluginSecurityConfig

Security-specific configuration options.

```typescript
interface PluginSecurityConfig {
  enableSandboxing?: boolean;
  defaultPermissions?: string[];
  trustedPlugins?: string[];
}
```

#### enableSandboxing

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable plugin sandboxing and isolation
- **Notes**: Requires additional system configuration for full isolation

#### defaultPermissions

- **Type**: `string[]`
- **Default**: `['file:read']`
- **Description**: Default permissions granted to all plugins
- **Common Values**:
  - `'file:read'` - Read file system
  - `'file:write'` - Write file system
  - `'network:http'` - HTTP network access
  - `'network:https'` - HTTPS network access
  - `'database:read'` - Database read access
  - `'database:write'` - Database write access
  - `'config:read'` - Configuration read access

#### trustedPlugins

- **Type**: `string[]`
- **Default**: `[]`
- **Description**: List of plugin IDs that receive elevated permissions
- **Example**: `['@plugins/core', '@plugins/admin', '@plugins/security']`

## Resource Limits

### DefaultResourceLimits

Default resource constraints applied to plugins.

```typescript
interface DefaultResourceLimits {
  maxMemory?: number;
  maxCpuTime?: number;
  maxFileDescriptors?: number;
}
```

#### maxMemory

- **Type**: `number`
- **Default**: `100 * 1024 * 1024` (100MB)
- **Description**: Maximum memory usage in bytes per plugin
- **Units**: Bytes
- **Example**: `50 * 1024 * 1024` (50MB)

#### maxCpuTime

- **Type**: `number`
- **Default**: `5000` (5 seconds)
- **Description**: Maximum CPU time in milliseconds per operation
- **Units**: Milliseconds
- **Range**: `100` - `60000` (100ms to 1 minute)

#### maxFileDescriptors

- **Type**: `number`
- **Default**: `100`
- **Description**: Maximum number of file descriptors per plugin
- **Range**: `10` - `1000`

## Plugin Host Configuration

### Application Configuration

Configuration in `apps/plugin-host/src/app/app.module.ts`:

```typescript
@Module({
  imports: [
    PluginCoreModule.forRoot({
      searchPaths: ['./plugins'],
      autoStart: true,
      enableMemoryMonitoring: true,
      defaultTimeout: 30000,
      defaultRetries: 3,
      parallelLoading: true,
      securityConfig: {
        enableSandboxing: true,
        defaultPermissions: ['file:read', 'network:http'],
        trustedPlugins: ['@plugins/core', '@plugins/admin'],
      },
      resourceLimits: {
        maxMemory: 100 * 1024 * 1024, // 100MB
        maxCpuTime: 5000, // 5 seconds
        maxFileDescriptors: 100
      }
    }),
  ],
})
export class AppModule {}
```

### Environment Variables

The plugin host supports configuration via environment variables:

#### PORT

- **Default**: `3000`
- **Description**: HTTP server port
- **Example**: `PORT=8080`

#### NODE_ENV

- **Values**: `development`, `production`, `test`
- **Default**: `development`
- **Description**: Application environment mode

#### PLUGIN_SEARCH_PATHS

- **Format**: Comma-separated paths
- **Description**: Override default plugin search paths
- **Example**: `PLUGIN_SEARCH_PATHS=./plugins,./custom,/opt/plugins`

#### PLUGIN_AUTO_START

- **Values**: `true`, `false`
- **Default**: `true`
- **Description**: Enable automatic plugin startup

#### PLUGIN_MEMORY_MONITORING

- **Values**: `true`, `false`
- **Default**: `true`
- **Description**: Enable memory monitoring

#### PLUGIN_PARALLEL_LOADING

- **Values**: `true`, `false`
- **Default**: `true`
- **Description**: Enable parallel plugin loading

#### PLUGIN_DEFAULT_TIMEOUT

- **Format**: Number (milliseconds)
- **Default**: `30000`
- **Description**: Default plugin loading timeout

## Async Configuration

### PluginCoreAsyncConfig

For dynamic configuration based on other services:

```typescript
interface PluginCoreAsyncConfig extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<PluginCoreOptionsFactory>;
  useClass?: Type<PluginCoreOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PluginCoreConfig> | PluginCoreConfig;
  inject?: any[];
}
```

### Factory Configuration Example

```typescript
@Module({
  imports: [
    PluginCoreModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        searchPaths: configService.get('PLUGIN_SEARCH_PATHS', ['./plugins']),
        autoStart: configService.get('PLUGIN_AUTO_START', true),
        enableMemoryMonitoring: configService.get('PLUGIN_MEMORY_MONITORING', true),
        defaultTimeout: configService.get('PLUGIN_DEFAULT_TIMEOUT', 30000),
        defaultRetries: configService.get('PLUGIN_DEFAULT_RETRIES', 3),
        parallelLoading: configService.get('PLUGIN_PARALLEL_LOADING', true),
        securityConfig: {
          enableSandboxing: configService.get('PLUGIN_SANDBOXING', false),
          defaultPermissions: configService.get('PLUGIN_DEFAULT_PERMISSIONS', ['file:read']),
          trustedPlugins: configService.get('PLUGIN_TRUSTED', [])
        }
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Feature Configuration

### PluginFeatureConfig

Configuration for plugin features and modules:

```typescript
interface PluginFeatureConfig {
  name: string;
  searchPaths?: string[];
  autoLoad?: boolean;
  config?: Partial<PluginCoreConfig>;
}
```

### Feature Module Example

```typescript
@Module({
  imports: [
    PluginCoreModule.forFeature({
      name: 'admin-features',
      searchPaths: ['./admin-plugins'],
      autoLoad: true,
      config: {
        defaultTimeout: 60000,
        securityConfig: {
          trustedPlugins: ['@plugins/admin-core']
        }
      }
    })
  ]
})
export class AdminModule {}
```

## Nx Configuration

### workspace.json / project.json

Plugin projects are configured with Nx targets:

```json
{
  "targets": {
    "build": {
      "executor": "@workspace/plugin:build",
      "options": {
        "outputPath": "dist/plugins/my-plugin",
        "tsConfig": "plugins/my-plugin/tsconfig.lib.json"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "plugins/my-plugin/jest.config.ts"
      }
    },
    "lint": {
      "executor": "@workspace/plugin:lint",
      "options": {
        "eslintConfig": "plugins/my-plugin/eslint.config.mjs"
      }
    },
    "zip": {
      "executor": "@workspace/plugin:zip",
      "options": {
        "outputPath": "dist/plugins/my-plugin"
      }
    }
  }
}
```

## Performance Tuning

### Recommended Settings

#### Development Environment

```typescript
{
  searchPaths: ['./plugins'],
  autoStart: true,
  enableMemoryMonitoring: true,
  defaultTimeout: 10000,
  defaultRetries: 1,
  parallelLoading: true,
  securityConfig: {
    enableSandboxing: false,
    defaultPermissions: ['file:read', 'file:write', 'network:http'],
    trustedPlugins: ['*'] // Trust all in development
  }
}
```

#### Production Environment

```typescript
{
  searchPaths: ['/opt/nizaami/plugins'],
  autoStart: true,
  enableMemoryMonitoring: true,
  defaultTimeout: 30000,
  defaultRetries: 3,
  parallelLoading: true,
  securityConfig: {
    enableSandboxing: true,
    defaultPermissions: ['file:read'],
    trustedPlugins: ['@plugins/core', '@plugins/auth']
  },
  resourceLimits: {
    maxMemory: 50 * 1024 * 1024, // 50MB
    maxCpuTime: 3000,
    maxFileDescriptors: 50
  }
}
```

#### High-Performance Environment

```typescript
{
  searchPaths: ['/opt/nizaami/plugins'],
  autoStart: true,
  enableMemoryMonitoring: false, // Disable for max performance
  defaultTimeout: 15000,
  defaultRetries: 2,
  parallelLoading: true,
  resourceLimits: {
    maxMemory: 200 * 1024 * 1024, // 200MB
    maxCpuTime: 10000,
    maxFileDescriptors: 200
  }
}
```

## Validation Rules

### Configuration Validation

The system validates configuration at startup:

- `searchPaths`: Must be valid directory paths
- `defaultTimeout`: Must be between 1000ms and 300000ms
- `defaultRetries`: Must be between 0 and 10
- `maxMemory`: Must be at least 10MB
- `maxCpuTime`: Must be at least 100ms
- `trustedPlugins`: Must be valid plugin names

### Error Handling

Invalid configurations result in:

- Warning logs for non-critical issues
- Error logs and startup failure for critical issues
- Fallback to default values where possible

## Migration Guide

### From Version 1.x to 2.x

Configuration changes:

1. `pluginPaths` renamed to `searchPaths`
2. Added `resourceLimits` configuration
3. Security configuration moved to `securityConfig` object
4. Memory monitoring enabled by default

### Migration Script

```typescript
// Old configuration (v1.x)
const oldConfig = {
  pluginPaths: ['./plugins'],
  autoStart: true,
  timeout: 30000,
  sandboxing: true
};

// New configuration (v2.x)
const newConfig = {
  searchPaths: oldConfig.pluginPaths,
  autoStart: oldConfig.autoStart,
  defaultTimeout: oldConfig.timeout,
  enableMemoryMonitoring: true,
  securityConfig: {
    enableSandboxing: oldConfig.sandboxing
  }
};
```
