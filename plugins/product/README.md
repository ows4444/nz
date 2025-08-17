# Product Plugin

A Nizaami platform plugin generated with the nizaami-plugin generator.

## Overview

This plugin provides:

- `ProductController` - Main controller for plugin endpoints
- `ProductService` - Core business logic service

## Development

### Building

```bash
nx build product
```

### Testing

```bash
nx test product
```

### Linting

```bash
nx lint product
```

### Type Checking

```bash
nx typecheck product
```

### Creating Distribution Package

```bash
nx zip product
```

## Plugin Structure

- `src/lib/controllers/` - Plugin controllers
- `src/lib/services/` - Plugin services
- `plugin.manifest.json` - Plugin configuration and metadata

## Plugin Configuration

The plugin manifest (`plugin.manifest.json`) contains:

- Plugin metadata (name, version, description)
- Security and trust level settings
- Permission configurations
- Module exports and dependencies
