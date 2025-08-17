# User Plugin

A Nizaami platform plugin generated with the nizaami-plugin generator.

## Overview

This plugin provides:

- `UserController` - Main controller for plugin endpoints
- `UserService` - Core business logic service

## Development

### Building

```bash
nx build user
```

### Testing

```bash
nx test user
```

### Linting

```bash
nx lint user
```

### Type Checking

```bash
nx typecheck user
```

### Creating Distribution Package

```bash
nx zip user
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
