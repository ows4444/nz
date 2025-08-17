# Nizaami Plugin System Documentation

## Overview

Welcome to the Nizaami Plugin System documentation. This is a comprehensive, NestJS-based plugin architecture that provides secure, scalable dynamic plugin loading and management.

## Documentation Structure

### Getting Started

- **[Getting Started Guide](guides/getting-started.md)** - Set up your development environment and understand basic concepts
- **[Plugin Development Guide](guides/plugin-development.md)** - Complete guide to developing plugins

### Architecture

- **[System Overview](architecture/overview.md)** - High-level architecture and design principles
- **[Plugin Manifest Structure](architecture/plugin-manifest.md)** - Plugin configuration and metadata format

### API Reference

- **[PluginCore Service](api/plugin-core-service.md)** - Main plugin management service API
- **[Interfaces and Types](api/interfaces.md)** - Core interfaces and type definitions

### Configuration

- **[Configuration Reference](reference/configuration.md)** - Complete configuration options and examples

## Quick Navigation

### For Developers

1. Start with the [Getting Started Guide](guides/getting-started.md)
2. Follow the [Plugin Development Guide](guides/plugin-development.md)
3. Reference the [Plugin Manifest Structure](architecture/plugin-manifest.md)

### For Architects

1. Review the [System Overview](architecture/overview.md)
2. Understand the [Configuration Options](reference/configuration.md)
3. Examine the [API Reference](api/plugin-core-service.md)

### For DevOps

1. Check the [Configuration Reference](reference/configuration.md)
2. Review security settings in the [System Overview](architecture/overview.md)
3. Understand deployment in the [Getting Started Guide](guides/getting-started.md)

## Key Features

- **Dynamic Plugin Loading**: Load plugins at runtime without application restart
- **Dependency Management**: Automatic resolution of plugin dependencies
- **Security & Sandboxing**: Configurable security policies and resource limits
- **Memory Monitoring**: Real-time memory usage tracking
- **Parallel Loading**: Efficient parallel plugin loading
- **NestJS Integration**: Seamless integration with NestJS ecosystem
- **TypeScript Support**: Full TypeScript support with type safety

## System Requirements

- Node.js 18+
- TypeScript 4.9+
- NestJS 10+
- Nx 21+

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd nz
npm install

# Build and start
nx build plugin-host
nx serve plugin-host

# Generate a new plugin
nx generate @workspace/plugin:with-manifest-only my-plugin

# Build and package plugin
nx run my-plugin:build
nx run my-plugin:zip
```

## Architecture Highlights

### Core Components

- **Plugin Core Library**: Centralized plugin management system
- **Plugin Host Application**: Main NestJS application hosting plugins
- **Plugin Tooling**: Development tools and generators

### Plugin Lifecycle

1. **Discovery** → 2. **Loading** → 3. **Instantiation** → 4. **Verification** → 5. **Orchestration**

### Security Model

- Trust levels (Trusted, Unverified, Restricted)
- Permission-based access control
- Resource limits and monitoring
- Sandboxing capabilities

## Common Use Cases

### Microservices Architecture

Break monolithic applications into dynamic, loadable plugins for better modularity and maintainability.

### Feature Toggles

Enable/disable application features by loading/unloading plugins without code changes.

### Third-Party Integration

Allow third-party developers to extend your application through plugins with controlled access.

### Multi-Tenant Applications

Load tenant-specific functionality as plugins based on configuration or user context.

## Support and Contributing

### Getting Help

- Review the troubleshooting sections in each guide
- Check the example plugins in the `plugins/` directory
- Examine test files for usage patterns

### Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the coding standards
4. Add comprehensive tests
5. Update documentation
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
