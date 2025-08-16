# Nizaami Plugin Library

An Nx plugin that provides executors and generators for creating Nizaami platform plugins.

## Features

### Executors
- **build** - TypeScript compilation with asset copying
- **lint** - ESLint execution with auto-fix support
- **zip** - Distribution package creation

### Generators
- **with-manifest-only** - Complete plugin project generation

## Building

```bash
nx build plugin
```

## Testing

```bash
nx test plugin
```

## Usage

Generate a new plugin:
```bash
nx generate @workspace/plugin:with-manifest-only my-plugin
```

This creates a complete plugin project in `plugins/my-plugin/` with:
- NestJS-style controller and service
- Complete test suite
- Plugin manifest configuration
- Build, test, lint, and zip targets
