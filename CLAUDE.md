# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is an Nx monorepo. Use these commands for development:

### Building

- `nx build <project>` - Build a specific project (e.g., `nx build plugin-host`, `nx build plugin-core`)
- `nx build` - Build all projects

### Testing

- `nx test <project>` - Run tests for a specific project (e.g., `nx test plugin-core`, `nx test auth`)
- `nx test` - Run all tests
- `nx test <project> --watch` - Run tests in watch mode

### Linting

- `nx lint <project>` - Lint a specific project
- `nx lint` - Lint all projects

### Plugin Development

- `nx generate @workspace/plugin:with-manifest-only <plugin-name>` - Generate a new plugin
- `nx build <plugin-name>` - Build a plugin
- `nx zip <plugin-name>` - Create distribution package for a plugin

### Type Checking

- `nx typecheck <project>` - Type check a specific project

## Architecture Overview

This is a **plugin-based microkernel architecture** for a NestJS application called "Nizaami". The system consists of:

### Core Components

1. **Plugin Host** (`apps/plugin-host/`) - Main NestJS application that hosts and orchestrates plugins
2. **Plugin Core Library** (`libs/plugin-core/`) - Core plugin management infrastructure with:
   - `PluginManagerService` - Central orchestrator for plugin lifecycle
   - `PluginDiscoveryService` - Discovers and loads plugins from filesystem
   - `PluginModuleFactory` - Creates NestJS modules from plugin manifests
   - Plugin validation, error handling, and security services

3. **Plugin System** (`plugins/`) - Individual feature plugins (auth, product, user)
4. **Plugin Tooling** (`tools/plugin/`) - Nx plugin providing executors and generators

### Plugin Architecture

- Each plugin has a `plugin.manifest.json` with metadata (name, version, dependencies, permissions, security)
- Plugins follow NestJS patterns with controllers, services, and modules
- Plugins are dynamically loaded at runtime with security sandboxing
- Plugin distribution packages are created as zip files in `releases/` directories

### Key Configuration

The Plugin Host configures the core in `app.module.ts` with:

- Search paths for plugins (`./plugins`)
- Security settings (sandboxing, permissions, trusted plugins)
- Memory monitoring and performance metrics
- Parallel loading capabilities

### Workspaces Structure

Uses npm workspaces with these directories:

- `apps/*` - Applications (plugin-host, e2e tests)
- `plugins/*` - Feature plugins
- `tools/*` - Development tooling
- `libs/*` - Shared libraries

### Plugin Development Workflow

1. Generate: `nx generate @workspace/plugin:with-manifest-only my-plugin`
2. Develop: Edit controllers/services in `plugins/my-plugin/src/lib/`
3. Build: `nx build my-plugin`
4. Test: `nx test my-plugin`
5. Package: `nx zip my-plugin` (creates release in `plugins/my-plugin/releases/`)

### Security Model

Plugins operate with:

- Trust levels (unverified, trusted)
- Permission system for services and modules
- Sandboxing capabilities
- Cross-plugin service restrictions
