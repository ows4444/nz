# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is an Nx monorepo. Use the following commands:

### Building

- `nx build <project>` - Build a specific project
- `nx build plugin-host` - Build the main plugin host application
- `nx build plugin-core` - Build the core plugin library
- `nx build auth` - Build the auth plugin
- `nx build product` - Build the product plugin
- `nx build user` - Build the user plugin

### Testing

- `nx test <project>` - Run tests for a specific project
- `nx test plugin-core` - Test the core plugin system
- `nx test plugin` - Test the plugin tooling

### Linting

- `nx lint <project>` - Lint a specific project
- `nx lint plugin-host` - Lint the plugin host

### Plugin Development

- `nx generate @workspace/plugin:with-manifest-only <plugin-name>` - Generate a new plugin
- `nx run <plugin>:build` - Build a plugin
- `nx run <plugin>:lint` - Lint a plugin  
- `nx run <plugin>:zip` - Package a plugin for distribution

## Architecture Overview

### Plugin System Architecture

This is a NestJS-based plugin architecture with the following key components:

#### Core Libraries

- **libs/plugin-core**: The central plugin system containing:
  - Discovery services for finding plugins
  - Loading strategies (parallel/sequential)
  - Security and memory management
  - Plugin lifecycle management
  - Coordination and orchestration services

#### Plugin Host Application

- **apps/plugin-host**: Main NestJS application that hosts plugins
- Configures the plugin system with security settings, search paths, and loading strategies
- Located in `apps/plugin-host/src/app/app.module.ts:6-18`

#### Plugin Structure

Plugins are located in the `plugins/` directory and follow this structure:

- Each plugin has a `plugin.manifest.json` with metadata and configuration
- NestJS-style controllers and services
- Standard TypeScript project structure with tests

#### Plugin Tooling

- **tools/plugin**: Nx plugin providing executors for build, lint, and zip operations
- Generators for scaffolding new plugins

### Key Configuration Files

- `nx.json`: Nx workspace configuration with plugin system excludes
- `tsconfig.base.json`: Base TypeScript configuration for the monorepo
- Plugin manifests define security trust levels, permissions, and module exports

### Security Model

The plugin system includes:

- Sandboxing capabilities
- Permission-based access control
- Trust levels for plugins
- Memory monitoring and management
- Dependency resolution with security checks

### Plugin Lifecycle

1. Discovery: Plugins found in configured search paths
2. Loading: Parallel or sequential loading based on configuration
3. Instantiation: Dynamic module creation and service registration
4. Verification: Post-load security and dependency checks
5. State Management: Runtime plugin state tracking

### Development Notes

- Plugin development uses the generator at `tools/plugin`
- All plugins follow NestJS patterns with controllers and services
- Plugin manifests are required for all plugins
- Security configuration is centralized in the plugin host
