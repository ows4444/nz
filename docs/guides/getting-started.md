# Getting Started with Nizaami Plugin System

## Overview

The Nizaami Plugin System is a powerful, NestJS-based platform for building modular applications with dynamic plugin loading. This guide will help you set up the development environment and understand the basic concepts.

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Latest version
- **Git**: For version control
- **TypeScript**: Basic knowledge recommended
- **NestJS**: Basic knowledge recommended

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nz
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Nx CLI (Optional but Recommended)

```bash
npm install -g nx
```

## Project Structure

``` plaintext
nz/
├── apps/
│   └── plugin-host/          # Main application that hosts plugins
├── libs/
│   └── plugin-core/          # Core plugin system library
├── plugins/                  # Plugin implementations
│   ├── auth/                 # Authentication plugin
│   ├── product/              # Product management plugin
│   └── user/                 # User management plugin
├── tools/
│   └── plugin/              # Plugin development tools
├── docs/                    # Documentation
└── nx.json                  # Nx workspace configuration
```

## Core Concepts

### 1. Plugin Host

The plugin host (`apps/plugin-host`) is the main NestJS application that:

- Discovers plugins in configured directories
- Loads plugins with security and dependency management
- Provides a REST API for plugin functionality
- Manages plugin lifecycle (start, stop, restart)

### 2. Plugin Core

The plugin core (`libs/plugin-core`) provides:

- Plugin discovery and loading mechanisms
- Security and sandboxing features
- Memory monitoring and resource management
- Plugin state management and orchestration

### 3. Plugins

Plugins are self-contained NestJS modules that:

- Follow a standard structure with controllers and services
- Define their capabilities in a manifest file
- Can depend on other plugins
- Are dynamically loaded at runtime

## Quick Start

### 1. Build the Project

```bash
nx build plugin-host
```

### 2. Start the Plugin Host

```bash
nx serve plugin-host
```

The application will start on `http://localhost:3000` and automatically discover and load plugins from the `plugins/` directory.

### 3. Verify Plugin Loading

Check the console output for plugin loading messages:

``` bash
[PluginCore] Discovering plugins in paths: ./plugins
[PluginCore] Discovered 3 plugins
[PluginCore] Auto-loaded 3 plugins
```

### 4. Test Plugin Endpoints

Test the loaded plugins via REST API:

```bash
# Test auth plugin
curl http://localhost:3000/api/auth

# Test user plugin
curl http://localhost:3000/api/user

# Test product plugin
curl http://localhost:3000/api/product
```

## Development Commands

### Building

- `nx build <project>` - Build a specific project
- `nx build plugin-host` - Build the main application
- `nx build plugin-core` - Build the core library

### Testing

- `nx test <project>` - Run tests for a specific project
- `nx test plugin-core` - Test the core plugin system

### Linting

- `nx lint <project>` - Lint a specific project

### Plugin Development

- `nx generate @workspace/plugin:with-manifest-only <name>` - Generate new plugin
- `nx run <plugin>:build` - Build a plugin
- `nx run <plugin>:lint` - Lint a plugin
- `nx run <plugin>:zip` - Package a plugin

## Understanding Plugin Configuration

### Plugin Host Configuration

The plugin host is configured in `apps/plugin-host/src/app/app.module.ts`:

```typescript
PluginCoreModule.forRoot({
  searchPaths: ['./plugins'],           // Where to look for plugins
  autoStart: true,                      // Auto-start plugins after loading
  enableMemoryMonitoring: true,         // Monitor plugin memory usage
  defaultTimeout: 30000,                // Loading timeout
  defaultRetries: 3,                    // Retry attempts for failed loads
  parallelLoading: true,                // Load plugins in parallel
  securityConfig: {
    enableSandboxing: true,             // Enable plugin sandboxing
    defaultPermissions: ['file:read', 'network:http'],
    trustedPlugins: ['core-plugin', 'admin-plugin'],
  },
})
```

### Plugin Manifest

Each plugin has a `plugin.manifest.json` file defining its metadata and requirements:

```json
{
  "name": "@plugins/example",
  "version": "1.0.0",
  "description": "Example plugin",
  "dependencies": [],
  "security": {
    "trustLevel": "unverified"
  },
  "permissions": {
    "services": ["ConfigService"],
    "modules": []
  },
  "module": {
    "controllers": ["ExampleController"],
    "providers": ["ExampleService"],
    "exports": ["ExampleService"]
  }
}
```

## Creating Your First Plugin

### 1. Generate Plugin Structure

```bash
nx generate @workspace/plugin:with-manifest-only my-first-plugin
```

### 2. Implement Plugin Logic

Edit the generated controller and service files to implement your functionality.

### 3. Update Manifest

Configure the plugin manifest with appropriate metadata and permissions.

### 4. Build and Test

```bash
nx run my-first-plugin:build
nx run my-first-plugin:test
```

### 5. Package for Distribution

```bash
nx run my-first-plugin:zip
```

## Plugin Discovery Process

1. **Search**: Plugin host searches configured directories
2. **Discovery**: Finds `plugin.manifest.json` files
3. **Validation**: Validates manifest structure and requirements
4. **Dependency Resolution**: Resolves plugin dependencies
5. **Loading**: Loads plugins in dependency order
6. **Instantiation**: Creates NestJS modules and services
7. **Verification**: Performs post-load security and functionality checks
8. **Orchestration**: Manages plugin lifecycle states

## Security Features

### Sandboxing

Plugins can be run in isolated environments with restricted access to system resources.

### Permissions

Fine-grained permission system controls what services and modules plugins can access.

### Trust Levels

- **Trusted**: Full system access
- **Unverified**: Standard permissions
- **Restricted**: Minimal access

### Resource Limits

Configurable limits on memory usage, CPU time, and file descriptors.

## Monitoring and Management

### Memory Monitoring

Real-time tracking of plugin memory usage with configurable alerts.

### Plugin States

Track plugin lifecycle states: UNLOADED, LOADING, LOADED, RUNNING, STOPPED, ERROR, UNLOADING.

### Logging

Structured logging with plugin-specific context and performance metrics.

## API Documentation

The plugin host exposes REST APIs for:

- Plugin management (start, stop, restart)
- System status and health checks
- Plugin-specific functionality

API documentation is available at `http://localhost:3000/api/docs` when running in development mode.

## Next Steps

1. **Read the Architecture Overview**: Understand the system design in `docs/architecture/overview.md`
2. **Follow the Plugin Development Guide**: Learn to build plugins in `docs/guides/plugin-development.md`
3. **Explore API Documentation**: Review interfaces and services in `docs/api/`
4. **Check Configuration Reference**: See all options in `docs/reference/configuration.md`

## Common Issues

### Plugin Not Loading

- Check manifest syntax and required fields
- Verify file permissions and paths
- Review console logs for error messages

### Permission Errors

- Ensure required services are listed in plugin permissions
- Check trust level configuration
- Verify security configuration in plugin host

### Build Failures

- Check TypeScript configuration
- Verify all imports are correct
- Ensure all dependencies are installed

## Getting Help

- Check the troubleshooting documentation
- Review example plugins in the `plugins/` directory
- Examine test files for usage examples
- Consult the API documentation for interface details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

Follow the coding standards and include appropriate documentation for new features.
