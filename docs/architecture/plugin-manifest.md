# Plugin Manifest Structure

## Overview

Plugin manifests define the metadata, configuration, and requirements for plugins in the Nizaami system. The system supports both legacy and modern manifest formats for backward compatibility.

## Modern Manifest Format

The current recommended format used by new plugins:

```json
{
  "name": "@plugins/example",
  "version": "1.0.0",
  "description": "Example plugin for demonstration",
  "author": "Plugin Developer",
  "license": "MIT",
  "keywords": ["nizaami", "plugin", "example"],
  "dependencies": [],
  "loadOrder": 0,
  "critical": false,
  "security": {
    "trustLevel": "unverified"
  },
  "permissions": {
    "services": ["ConfigService", "DatabaseService"],
    "modules": ["UserModule"]
  },
  "module": {
    "controllers": ["ExampleController"],
    "providers": ["ExampleService"],
    "exports": ["ExampleService"],
    "crossPluginServices": [],
    "guards": ["ExampleGuard"]
  }
}
```

## Legacy Manifest Format

Supported for backward compatibility:

```json
{
  "plugin": {
    "id": "example-plugin",
    "name": "Example Plugin",
    "version": "1.0.0",
    "description": "Example plugin for demonstration",
    "dependencies": ["core-plugin"]
  },
  "entryPoint": "./dist/index.js",
  "exports": ["ExampleService"],
  "permissions": ["file:read", "network:http"]
}
```

## Field Definitions

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Plugin identifier (scoped package name format) |
| `version` | string | Yes | Semantic version string |
| `description` | string | No | Human-readable description |
| `author` | string | No | Plugin author information |
| `license` | string | No | License type (e.g., MIT, Apache-2.0) |
| `keywords` | string[] | No | Keywords for plugin discovery and categorization |

### Loading Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `dependencies` | string[] | `[]` | List of plugin dependencies that must be loaded first |
| `loadOrder` | number | `0` | Loading priority (-1 = highest, higher numbers load later) |
| `critical` | boolean | `false` | Whether plugin failure should halt system startup |

### Security Configuration

```json
{
  "security": {
    "trustLevel": "unverified" | "trusted" | "restricted"
  }
}
```

- **unverified**: Default trust level with standard permissions
- **trusted**: High trust level with extended permissions
- **restricted**: Minimal permissions, highly sandboxed

### Permissions

```json
{
  "permissions": {
    "services": ["ServiceName1", "ServiceName2"],
    "modules": ["ModuleName1", "ModuleName2"]
  }
}
```

- **services**: NestJS services the plugin can inject
- **modules**: NestJS modules the plugin can access

### Module Definition

```json
{
  "module": {
    "controllers": ["ControllerClass1"],
    "providers": ["ServiceClass1", "ServiceClass2"],
    "exports": ["ServiceClass1"],
    "crossPluginServices": ["SharedService"],
    "guards": ["AuthGuard", "RoleGuard"]
  }
}
```

- **controllers**: REST controllers exposed by the plugin
- **providers**: Services and providers defined by the plugin
- **exports**: Services exported for use by other plugins
- **crossPluginServices**: Services available across plugin boundaries
- **guards**: Authentication/authorization guards

## Validation Rules

### Required Fields

- `name`: Must be a valid scoped package name
- `version`: Must follow semantic versioning

### Name Format

- Modern format: `@plugins/plugin-name`
- Legacy format: `plugin-name` or `plugin_name`

### Version Format

- Must follow semantic versioning (e.g., `1.0.0`, `2.1.3-beta.1`)

### Dependencies

- Must reference existing plugin names
- Circular dependencies are not allowed
- Dependencies are resolved before plugin loading

### Load Order

- Numeric value determining loading sequence
- Negative values load first (highest priority)
- Plugins with same load order may load in parallel

## Transformation Process

The discovery service automatically transforms between formats:

1. **Modern to Internal**: Direct mapping to `PluginManifest` interface
2. **Legacy to Internal**: Converts legacy format to modern structure
3. **Entry Point Resolution**: Automatically resolves to `dist/index.js`

## Best Practices

### Naming Convention

- Use scoped package names: `@plugins/your-plugin-name`
- Use kebab-case for plugin names
- Include descriptive keywords

### Versioning

- Follow semantic versioning strictly
- Increment versions for any changes
- Use pre-release tags for development versions

### Dependencies

- Minimize dependencies to reduce coupling
- Use specific version ranges when possible
- Document dependency requirements

### Security

- Start with `unverified` trust level
- Request minimal required permissions
- Document security requirements

### Module Structure

- Export only necessary services
- Use clear, descriptive class names
- Follow NestJS best practices

## Example Manifests

### Simple Plugin

```json
{
  "name": "@plugins/hello-world",
  "version": "1.0.0",
  "description": "Simple hello world plugin",
  "module": {
    "controllers": ["HelloController"],
    "providers": ["HelloService"],
    "exports": ["HelloService"]
  }
}
```

### Plugin with Dependencies

```json
{
  "name": "@plugins/user-management",
  "version": "2.1.0",
  "description": "User management functionality",
  "dependencies": ["@plugins/auth", "@plugins/database"],
  "loadOrder": 10,
  "security": {
    "trustLevel": "trusted"
  },
  "permissions": {
    "services": ["DatabaseService", "ConfigService"],
    "modules": ["AuthModule"]
  },
  "module": {
    "controllers": ["UserController"],
    "providers": ["UserService", "UserRepository"],
    "exports": ["UserService"],
    "guards": ["AdminGuard"]
  }
}
```
