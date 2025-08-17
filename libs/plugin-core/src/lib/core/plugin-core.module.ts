import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { PluginCore } from './plugin-core.service';

// Discovery & Loading
import { PluginDiscoveryService } from '../discovery/plugin-discovery.service';
import { PluginLoaderService } from '../loading/plugin-loader.service';
import { PluginLoaderFactory } from '../loading/plugin-loader-factory';
import { PluginLoaderStrategyFactory } from '../loading/plugin-loader-strategy-factory';
import { PluginLoadingStrategyFactory } from '../loading/plugin-loading-strategy-factory';
import { ParallelLoadingStrategyService } from '../loading/parallel-loading-strategy.service';
import { DefaultPluginLoaderStrategy } from '../loading/default-plugin-loader-strategy.service';
import { DynamicPluginModuleGeneratorService } from '../loading/dynamic-plugin-module-generator.service';

// Registry & Coordination
import { PluginLoaderCoordinatorService } from '../registry/plugin-loader-coordinator.service';
import { PluginLoaderCoordinatorFactory } from '../registry/plugin-loader-coordinator-factory';
import { PluginOrchestratorService } from '../registry/plugin-orchestrator.service';

// Lifecycle & State
import { PluginStateManagerService } from '../lifecycle/plugin-state-manager.service';
import { PluginInstantiationService } from '../lifecycle/plugin-instantiation.service';
import { PluginPostLoadVerificationService } from '../lifecycle/plugin-post-load-verification.service';

// Security & Resources
import { PluginSecurityManagerService } from '../security/plugin-security-manager.service';
import { PluginMemoryManagerService } from '../security/plugin-memory-manager.service';
import { PluginDependencyResolverService } from '../security/plugin-dependency-resolver.service';

// Configuration
import {
  PluginCoreConfig,
  PluginCoreAsyncConfig,
  PluginCoreOptionsFactory,
  PluginFeatureConfig,
  PluginFeatureAsyncConfig,
  PluginFeatureOptionsFactory,
  PLUGIN_CORE_CONFIG,
  PLUGIN_FEATURE_CONFIG,
} from '../types/plugin-core-config.interface';

@Module({})
export class PluginCoreModule {
  static forRoot(config?: PluginCoreConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      global: true,
      providers: [
        {
          provide: PLUGIN_CORE_CONFIG,
          useValue: config || {},
        },
        ...this.createCoreProviders(),
        {
          provide: 'PLUGIN_MODULE_REGISTRY',
          useFactory: () => new Map(),
        },
      ],
      exports: [
        PLUGIN_CORE_CONFIG,
        ...this.createCoreExports(),
        'PLUGIN_MODULE_REGISTRY',
      ],
    };
  }

  static forRootAsync(options: PluginCoreAsyncConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      global: true,
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        ...this.createCoreProviders(),
      ],
      exports: [PLUGIN_CORE_CONFIG, ...this.createCoreExports()],
    };
  }

  static register(config?: PluginCoreConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      providers: [
        {
          provide: PLUGIN_CORE_CONFIG,
          useValue: config || {},
        },
        ...this.createCoreProviders(),
      ],
      exports: [PLUGIN_CORE_CONFIG, ...this.createCoreExports()],
    };
  }

  static registerAsync(options: PluginCoreAsyncConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        ...this.createCoreProviders(),
      ],
      exports: [PLUGIN_CORE_CONFIG, ...this.createCoreExports()],
    };
  }

  static forFeature(config: PluginFeatureConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      providers: [
        {
          provide: `${String(PLUGIN_FEATURE_CONFIG)}_${config.name}`,
          useValue: config,
        },
      ],
      exports: [`${String(PLUGIN_FEATURE_CONFIG)}_${config.name}`],
    };
  }

  static forFeatureAsync(options: PluginFeatureAsyncConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      imports: options.imports || [],
      providers: [...this.createFeatureAsyncProviders(options)],
      exports: [`${String(PLUGIN_FEATURE_CONFIG)}_${options.name}`],
    };
  }

  private static createCoreProviders(): Provider[] {
    return [
      // Core service
      PluginCore,

      // Discovery & Loading
      PluginDiscoveryService,
      PluginLoaderService,
      PluginLoaderFactory,
      PluginLoaderStrategyFactory,
      PluginLoadingStrategyFactory,
      ParallelLoadingStrategyService,
      DefaultPluginLoaderStrategy,
      DynamicPluginModuleGeneratorService,

      // Coordination
      PluginLoaderCoordinatorService,
      PluginLoaderCoordinatorFactory,

      // Orchestration
      PluginOrchestratorService,

      // Lifecycle & State
      PluginStateManagerService,
      PluginInstantiationService,
      PluginPostLoadVerificationService,

      // Security & Resources
      PluginSecurityManagerService,
      PluginMemoryManagerService,
      PluginDependencyResolverService,
    ];
  }

  private static createCoreExports(): (string | symbol | Type<any>)[] {
    return [
      // Core service
      PluginCore,

      // Discovery & Loading
      PluginDiscoveryService,
      PluginLoaderService,
      PluginLoaderFactory,
      PluginLoaderStrategyFactory,
      PluginLoadingStrategyFactory,
      ParallelLoadingStrategyService,
      DefaultPluginLoaderStrategy,
      DynamicPluginModuleGeneratorService,

      // Coordination
      PluginLoaderCoordinatorService,
      PluginLoaderCoordinatorFactory,

      // Orchestration
      PluginOrchestratorService,

      // Lifecycle & State
      PluginStateManagerService,
      PluginInstantiationService,
      PluginPostLoadVerificationService,

      // Security & Resources
      PluginSecurityManagerService,
      PluginMemoryManagerService,
      PluginDependencyResolverService,
    ];
  }

  private static createAsyncProviders(
    options: PluginCoreAsyncConfig
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncConfigProvider(options)];
    }

    return [
      this.createAsyncConfigProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  private static createAsyncConfigProvider(
    options: PluginCoreAsyncConfig
  ): Provider {
    if (options.useFactory) {
      return {
        provide: PLUGIN_CORE_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: PLUGIN_CORE_CONFIG,
      useFactory: async (optionsFactory: PluginCoreOptionsFactory) =>
        await optionsFactory.createPluginCoreOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }

  private static createFeatureAsyncProviders(
    options: PluginFeatureAsyncConfig
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createFeatureAsyncConfigProvider(options)];
    }

    return [
      this.createFeatureAsyncConfigProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  private static createFeatureAsyncConfigProvider(
    options: PluginFeatureAsyncConfig
  ): Provider {
    if (options.useFactory) {
      return {
        provide: `${String(PLUGIN_FEATURE_CONFIG)}_${options.name}`,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: `${String(PLUGIN_FEATURE_CONFIG)}_${options.name}`,
      useFactory: async (optionsFactory: PluginFeatureOptionsFactory) =>
        await optionsFactory.createPluginFeatureOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }
}
