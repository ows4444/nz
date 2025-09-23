import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { PluginCoreAsyncConfig, PluginCoreOptionsFactory, PLUGIN_CORE_CONFIG } from '../types/core/plugin-core-config.interface';
import { DiscoveryModule } from '@nestjs/core';
import { PluginMetadataService } from './plugin-metadata.service';
import { PluginManagerService } from './plugin-manager.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginStatisticsService } from './plugin-statistics.service';
import { PluginLifecycleManagerService } from './plugin-lifecycle-manager.service';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginManifestValidator } from './plugin-manifest-validator.service';
import { PluginModuleFactory } from './plugin-module-factory.service';
import { PluginConfigValidator } from './plugin-config-validator.service';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PluginDependencyResolver } from '../utils/plugin-dependency-resolver';
import { SemverValidator } from '../utils/semver-validator';

@Module({})
export class PluginCoreModule {
  static forRootAsync(options: PluginCoreAsyncConfig): DynamicModule {
    return {
      module: PluginCoreModule,
      global: true,
      imports: [DiscoveryModule, ...(options.imports || []), ...PluginManagerService.discoverPluginModules(options)],
      providers: [...this.createAsyncProviders(options), ...this.createCoreProviders()],
      exports: [PLUGIN_CORE_CONFIG, ...this.createCoreExports()],
    };
  }

  private static createCoreProviders(): Provider[] {
    return [
      // Core management services - NestJS will automatically manage these as singletons
      PluginMetadataService,
      PluginRegistryService,
      PluginStatisticsService,
      PluginLifecycleManagerService,
      PluginManagerService,
      PluginDiscoveryService,

      // Core utility services - also managed as singletons by NestJS
      PluginManifestValidator,
      PluginModuleFactory,
      PluginConfigValidator,
      PluginLifecycleService,
      PluginDependencyResolver,
      SemverValidator,
    ];
  }

  private static createCoreExports(): (string | symbol | Type<any>)[] {
    return [
      PluginManagerService,
      PluginRegistryService,
      PluginStatisticsService,
      PluginLifecycleManagerService,
      PluginDiscoveryService,
      PluginManifestValidator,
      PluginModuleFactory,
      PluginConfigValidator,
      PluginLifecycleService,
      PluginDependencyResolver,
      SemverValidator,
    ];
  }

  private static createAsyncProviders(options: PluginCoreAsyncConfig): Provider[] {
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

  private static createAsyncConfigProvider(options: PluginCoreAsyncConfig): Provider {
    if (options.useFactory) {
      return {
        provide: PLUGIN_CORE_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: PLUGIN_CORE_CONFIG,
      useFactory: async (optionsFactory: PluginCoreOptionsFactory) => await optionsFactory.createPluginCoreOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }
}
