# Plugin Development Guide

## Overview

This guide walks you through developing plugins for the Nizaami platform, from initial setup to deployment and testing.

## Prerequisites

- Node.js 18+ and npm
- Nx CLI installed globally: `npm install -g nx`
- Basic knowledge of NestJS and TypeScript

## Quick Start

### 1. Generate a New Plugin

Use the Nx generator to scaffold a new plugin:

```bash
nx generate @workspace/plugin:with-manifest-only my-plugin
```

This creates a complete plugin structure in `plugins/my-plugin/` with:

- NestJS controller and service
- Plugin manifest configuration
- Complete test suite
- Build and packaging configuration

### 2. Plugin Structure

``` plaintext
plugins/my-plugin/
├── src/
│   ├── index.ts                    # Plugin entry point
│   └── lib/
│       ├── controllers/
│       │   ├── my-plugin.controller.ts
│       │   └── my-plugin.controller.spec.ts
│       └── services/
│           ├── my-plugin.service.ts
│           └── my-plugin.service.spec.ts
├── plugin.manifest.json            # Plugin metadata
├── package.json                   # Package configuration
├── project.json                   # Nx project configuration
├── tsconfig.json                  # TypeScript configuration
├── tsconfig.lib.json              # Library TypeScript config
├── tsconfig.spec.json             # Test TypeScript config
├── jest.config.ts                 # Jest test configuration
└── eslint.config.mjs              # ESLint configuration
```

## Development Workflow

### 1. Configure Plugin Manifest

Edit `plugin.manifest.json` to define your plugin's metadata:

```json
{
  "name": "@plugins/my-plugin",
  "version": "1.0.0",
  "description": "Description of my plugin functionality",
  "author": "Your Name",
  "license": "MIT",
  "keywords": ["nizaami", "plugin", "functionality"],
  "dependencies": [],
  "loadOrder": 0,
  "critical": false,
  "security": {
    "trustLevel": "unverified"
  },
  "permissions": {
    "services": ["ConfigService"],
    "modules": []
  },
  "module": {
    "controllers": ["MyPluginController"],
    "providers": ["MyPluginService"],
    "exports": ["MyPluginService"],
    "crossPluginServices": [],
    "guards": []
  }
}
```

### 2. Implement Your Controller

```typescript
// src/lib/controllers/my-plugin.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { MyPluginService } from '../services/my-plugin.service';

@Controller('my-plugin')
export class MyPluginController {
  constructor(private readonly myPluginService: MyPluginService) {}

  @Get()
  getHello(): string {
    return this.myPluginService.getHello();
  }

  @Post('process')
  processData(@Body() data: any) {
    return this.myPluginService.processData(data);
  }
}
```

### 3. Implement Your Service

```typescript
// src/lib/services/my-plugin.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyPluginService {
  private readonly logger = new Logger(MyPluginService.name);

  getHello(): string {
    return 'Hello from My Plugin!';
  }

  processData(data: any) {
    this.logger.log('Processing data:', data);
    
    // Your business logic here
    const result = {
      processed: true,
      data: data,
      timestamp: new Date().toISOString()
    };

    return result;
  }

  // Optional lifecycle methods
  async start() {
    this.logger.log('Plugin starting...');
    // Initialize resources, connections, etc.
  }

  async stop() {
    this.logger.log('Plugin stopping...');
    // Cleanup resources, close connections, etc.
  }
}
```

### 4. Configure Plugin Entry Point

```typescript
// src/index.ts
import { Module } from '@nestjs/common';
import { MyPluginController } from './lib/controllers/my-plugin.controller';
import { MyPluginService } from './lib/services/my-plugin.service';

@Module({
  controllers: [MyPluginController],
  providers: [MyPluginService],
  exports: [MyPluginService],
})
export class MyPluginModule {}

// Export the module as default for plugin loading
export default MyPluginModule;

// Export individual components for external use
export { MyPluginService, MyPluginController };
```

## Testing Your Plugin

### 1. Unit Tests

Write comprehensive unit tests for your services:

```typescript
// src/lib/services/my-plugin.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MyPluginService } from './my-plugin.service';

describe('MyPluginService', () => {
  let service: MyPluginService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyPluginService],
    }).compile();

    service = module.get<MyPluginService>(MyPluginService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return hello message', () => {
    expect(service.getHello()).toBe('Hello from My Plugin!');
  });

  it('should process data correctly', () => {
    const testData = { test: 'value' };
    const result = service.processData(testData);
    
    expect(result.processed).toBe(true);
    expect(result.data).toEqual(testData);
    expect(result.timestamp).toBeDefined();
  });
});
```

### 2. Controller Tests

Test your REST endpoints:

```typescript
// src/lib/controllers/my-plugin.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MyPluginController } from './my-plugin.controller';
import { MyPluginService } from '../services/my-plugin.service';

describe('MyPluginController', () => {
  let controller: MyPluginController;
  let service: MyPluginService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyPluginController],
      providers: [MyPluginService],
    }).compile();

    controller = module.get<MyPluginController>(MyPluginController);
    service = module.get<MyPluginService>(MyPluginService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return hello message', () => {
    expect(controller.getHello()).toBe('Hello from My Plugin!');
  });
});
```

### 3. Run Tests

```bash
nx test my-plugin
```

## Building and Packaging

### 1. Build Your Plugin

```bash
nx run my-plugin:build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 2. Lint Your Code

```bash
nx run my-plugin:lint
```

Fix any linting issues before packaging.

### 3. Create Distribution Package

```bash
nx run my-plugin:zip
```

This creates a versioned zip file in the `releases/` directory ready for deployment.

## Advanced Features

### 1. Plugin Dependencies

If your plugin depends on other plugins, specify them in the manifest:

```json
{
  "dependencies": ["@plugins/auth", "@plugins/database"],
  "loadOrder": 10
}
```

Dependencies are loaded before your plugin, and you can inject their services:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { AuthService } from '@plugins/auth';

@Injectable()
export class MyPluginService {
  constructor(
    @Inject('AuthService') private authService: AuthService
  ) {}
}
```

### 2. Cross-Plugin Communication

Export services for use by other plugins:

```json
{
  "module": {
    "exports": ["MyPluginService"],
    "crossPluginServices": ["SharedDataService"]
  }
}
```

### 3. Configuration Management

Access the plugin host's configuration:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyPluginService {
  constructor(
    @Inject(ConfigService) private configService: ConfigService
  ) {}

  getSomeConfig() {
    return this.configService.get('MY_PLUGIN_SETTING');
  }
}
```

### 4. Database Integration

Request database permissions and inject database services:

```json
{
  "permissions": {
    "services": ["DatabaseService", "ConfigService"]
  }
}
```

```typescript
@Injectable()
export class MyPluginService {
  constructor(
    @Inject('DatabaseService') private db: DatabaseService
  ) {}

  async findUsers() {
    return await this.db.query('SELECT * FROM users');
  }
}
```

### 5. Guards and Middleware

Implement custom guards for authentication/authorization:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class MyPluginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Your authorization logic
    return true;
  }
}
```

Register in manifest:

```json
{
  "module": {
    "guards": ["MyPluginGuard"]
  }
}
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
@Injectable()
export class MyPluginService {
  private readonly logger = new Logger(MyPluginService.name);

  async processData(data: any) {
    try {
      // Process data
      return result;
    } catch (error) {
      this.logger.error('Failed to process data', error);
      throw new BadRequestException('Invalid data format');
    }
  }
}
```

### 2. Logging

Use structured logging:

```typescript
this.logger.log('Processing request', { userId, action: 'processData' });
this.logger.warn('Performance warning', { duration: 1500 });
this.logger.error('Processing failed', error, { userId, data });
```

### 3. Resource Management

Implement proper resource cleanup:

```typescript
@Injectable()
export class MyPluginService implements OnModuleDestroy {
  private connections: Connection[] = [];

  async onModuleDestroy() {
    // Close all connections
    await Promise.all(
      this.connections.map(conn => conn.close())
    );
  }
}
```

### 4. Security

- Request minimal required permissions
- Validate all input data
- Sanitize output data
- Use parameterized queries for database operations
- Implement proper authentication/authorization

### 5. Performance

- Use caching where appropriate
- Implement pagination for large datasets
- Use async/await for I/O operations
- Monitor memory usage in long-running operations

## Testing in the Plugin Host

### 1. Local Development

Start the plugin host with your plugin:

```bash
nx serve plugin-host
```

The host will automatically discover and load plugins from the `plugins/` directory.

### 2. API Testing

Test your plugin endpoints:

```bash
curl http://localhost:3000/api/my-plugin
curl -X POST http://localhost:3000/api/my-plugin/process \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 3. Plugin Management

Check plugin status and manage lifecycle through the plugin system APIs.

## Deployment

### 1. Build for Production

```bash
nx run my-plugin:build --configuration=production
nx run my-plugin:zip
```

### 2. Deploy Package

Copy the generated zip file from `releases/` to your production plugin directory and restart the plugin host.

## Troubleshooting

### Common Issues

1. **Plugin not loading**: Check manifest syntax and required fields
2. **Dependency injection errors**: Verify service exports and imports
3. **Permission errors**: Ensure required services are listed in permissions
4. **Build failures**: Check TypeScript configuration and imports

### Debug Mode

Enable debug logging in the plugin host configuration to see detailed loading information.

### Testing Isolation

Test plugins in isolation using the NestJS testing utilities before integration testing.
