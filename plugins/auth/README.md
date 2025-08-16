# Auth Plugin

A Nizaami platform plugin generated with the nizaami-plugin generator.

## Overview

This plugin provides:

- `AuthController` - Main controller for plugin endpoints
- `AuthService` - Core business logic service

## Development

### Building

```bash
nx build auth
```

### Testing

```bash
nx test auth
```

### Linting

```bash
nx lint auth
```

### Type Checking

```bash
nx typecheck auth
```

### Creating Distribution Package

```bash
nx zip auth
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
