# Plugin Core Architecture

This document describes the domain-driven architecture of the plugin-core library.

## Overview

The plugin-core library is organized around domain-driven design principles, with each domain representing a specific area of functionality in the plugin system.

## Domain Structure

### 🎯 Core Domain (`src/lib/core/`)

The main entry point and orchestration layer for the plugin system.

**Files:**

- `plugin-core.service.ts` - Main plugin system service
- `plugin-core.module.ts` - NestJS module configuration
- `plugin-core.service.spec.ts` - Unit tests

**Responsibilities:**

- System initialization and configuration
- High-level plugin system orchestration
- Module registration and dependency injection setup

### 🔍 Discovery Domain (`src/lib/discovery/`)

Handles plugin discovery and manifest parsing.

**Files:**

- `plugin-discovery.service.ts` - Plugin discovery and manifest loading

**Responsibilities:**

- Scanning filesystem for plugins
- Loading and validating plugin manifests
- Plugin metadata extraction

### 📦 Loading Domain (`src/lib/loading/`)

Manages plugin loading strategies and dynamic module generation.

**Files:**

- `plugin-loader.service.ts` - Core loading service
- `plugin-loader-factory.ts` - Factory for loader instances
- `plugin-loader-strategy-factory.ts` - Strategy pattern factory
- `plugin-loading-strategy-factory.ts` - Loading strategy factory
- `default-plugin-loader-strategy.service.ts` - Default loading strategy
- `parallel-loading-strategy.service.ts` - Parallel loading strategy
- `dynamic-plugin-module-generator.service.ts` - Dynamic NestJS module generation
- `plugin-loader-context.ts` - Loading context management

**Responsibilities:**

- Plugin loading strategy implementation
- Dynamic NestJS module creation
- Build-time and runtime plugin loading
- Module dependency resolution

### 🔄 Lifecycle Domain (`src/lib/lifecycle/`)

Manages plugin lifecycle states and transitions.

**Files:**

- `plugin-state-manager.service.ts` - Plugin state management
- `plugin-instantiation.service.ts` - Plugin instantiation logic
- `plugin-post-load-verification.service.ts` - Post-load validation

**Responsibilities:**

- Plugin state transitions (loading, running, stopped, etc.)
- Plugin instance creation and management
- Lifecycle hooks and event handling
- Plugin health monitoring

### 🔐 Security Domain (`src/lib/security/`)

Handles security, permissions, and resource management.

**Files:**

- `plugin-security-manager.service.ts` - Security policy enforcement
- `plugin-memory-manager.service.ts` - Memory monitoring and limits
- `plugin-dependency-resolver.service.ts` - Dependency validation

**Responsibilities:**

- Security policy enforcement
- Sandboxing and isolation
- Resource limit management
- Dependency validation and resolution

### 📋 Registry Domain (`src/lib/registry/`)

Coordinates plugin registration, orchestration, and inter-plugin communication.

**Files:**

- `plugin-loader-coordinator.service.ts` - Loading coordination
- `plugin-loader-coordinator-factory.ts` - Coordinator factory
- `plugin-orchestrator.service.ts` - Plugin orchestration

**Responsibilities:**

- Plugin registry management
- Cross-plugin service coordination
- Plugin orchestration and communication
- Load order management

### 📝 Types Domain (`src/lib/types/`)

Contains all TypeScript interfaces and type definitions.

**Files:**

- `plugin-strict-interfaces.ts` - Core plugin interfaces
- `plugin-utility-types.ts` - Utility types and helpers
- `plugin-core-config.interface.ts` - Configuration interfaces
- `plugin-loader-strategy.interface.ts` - Loading strategy interfaces
- `plugin-loading-strategy.interface.ts` - Loading strategy interfaces
- `plugin-loader-coordinator.interface.ts` - Coordinator interfaces
- `plugin-orchestrator.interface.ts` - Orchestration interfaces

**Responsibilities:**

- Type definitions for all domains
- Interface contracts between services
- Configuration schemas
- Utility types for type safety

## Domain Dependencies

``` plaintext
Core Domain
├── Discovery Domain
├── Loading Domain
├── Lifecycle Domain
├── Security Domain
├── Registry Domain
└── Types Domain (used by all)

Registry Domain
├── Lifecycle Domain
└── Security Domain

Loading Domain
├── Security Domain
└── Lifecycle Domain

Discovery Domain
└── Types Domain

Security Domain
└── Types Domain

Lifecycle Domain
└── Types Domain
```

## Key Design Principles

### 1. **Domain Separation**

Each domain has a clear responsibility and minimal coupling with other domains.

### 2. **Interface-Driven Design**

All domain interactions are defined through TypeScript interfaces in the Types domain.

### 3. **Factory Pattern**

Factories are used for creating strategy implementations and managing dependencies.

### 4. **Strategy Pattern**

Loading strategies can be easily extended and swapped based on requirements.

### 5. **Dependency Injection**

NestJS dependency injection is used throughout for testability and modularity.

## Import Structure

### Domain Exports

Each domain exports its public API through an `index.ts` file:

```typescript
// Import entire domain
import { PluginCore } from '@libs/plugin-core/core';

// Import specific services
import { PluginDiscoveryService } from '@libs/plugin-core/discovery';
```

### Cross-Domain Imports

When domains need to import from other domains, they use relative imports:

```typescript
// From Loading domain importing Types
import { PluginManifest } from '../types/plugin-strict-interfaces';

// From Core domain importing other domains
import { PluginDiscoveryService } from '../discovery/plugin-discovery.service';
```

## Extension Points

### 1. **Loading Strategies**

Implement `PluginLoaderStrategy` interface to create custom loading strategies.

### 2. **Security Policies**

Extend security domain services to implement custom security policies.

### 3. **Lifecycle Hooks**

Use the lifecycle domain to add custom plugin lifecycle management.

### 4. **Registry Coordination**

Extend registry services for custom plugin coordination logic.

## Best Practices

1. **Single Responsibility**: Each service should have one clear responsibility
2. **Interface Segregation**: Use specific interfaces rather than large, monolithic ones
3. **Dependency Direction**: Dependencies should flow toward the Types domain
4. **Immutable Data**: Use readonly interfaces where possible
5. **Error Handling**: Each domain should handle its own errors appropriately
6. **Logging**: Use structured logging with appropriate log levels
7. **Testing**: Each domain should be independently testable

## Future Considerations

- **Plugin Hot Reloading**: Extend Loading domain for development-time hot reloading
- **Plugin Marketplace**: Add marketplace integration to Discovery domain
- **Advanced Security**: Extend Security domain with code signing and verification
- **Metrics Collection**: Add observability features to Lifecycle domain
- **Plugin Communication**: Enhance Registry domain with pub/sub messaging
