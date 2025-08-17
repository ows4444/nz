import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { PluginCore } from './plugin-core.service';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { PluginDiscoveryService } from '../discovery/plugin-discovery.service';
import { DynamicPluginModuleGeneratorService } from '../loading/dynamic-plugin-module-generator.service';
import { PluginLoaderService } from '../loading/plugin-loader.service';
import { PluginLoaderFactory } from '../loading/plugin-loader-factory';
import { PluginLoaderStrategyFactory } from '../loading/plugin-loader-strategy-factory';
import { PluginLoadingStrategyFactory } from '../loading/plugin-loading-strategy-factory';
import { ParallelLoadingStrategyService } from '../loading/parallel-loading-strategy.service';
import { DefaultPluginLoaderStrategy } from '../loading/default-plugin-loader-strategy.service';
import { PluginLoaderCoordinatorService } from '../registry/plugin-loader-coordinator.service';
import { PluginLoaderCoordinatorFactory } from '../registry/plugin-loader-coordinator-factory';
import { PluginOrchestratorService } from '../registry/plugin-orchestrator.service';
import { PluginStateManagerService } from '../lifecycle/plugin-state-manager.service';
import { PluginInstantiationService } from '../lifecycle/plugin-instantiation.service';
import { PluginPostLoadVerificationService } from '../lifecycle/plugin-post-load-verification.service';
import { PluginSecurityManagerService } from '../security/plugin-security-manager.service';
import { PluginMemoryManagerService } from '../security/plugin-memory-manager.service';
import { PluginDependencyResolverService } from '../security/plugin-dependency-resolver.service';
import {
  PluginCoreAsyncConfig,
  PluginCoreOptionsFactory,
  PLUGIN_CORE_CONFIG,
} from '../types/plugin-core-config.interface';

@Module({})
export class PluginCoreModule {
  static forRootAsync(options: PluginCoreAsyncConfig): DynamicModule {
    // const discoveredPluginModules =  this.preDiscoverPluginModules(options);
    return {
      module: PluginCoreModule,
      global: true,
      //imports: [...(options.imports || []), ...discoveredPluginModules],
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        ...this.createCoreProviders(),
      ],
      exports: [PLUGIN_CORE_CONFIG, ...this.createCoreExports()],
    };
  }
  private static preDiscoverPluginModules(
    options: PluginCoreAsyncConfig
  ): any[] {
    try {
      if (options.useFactory) {
        const pluginModules: any[] = [];
        const defaultSearchPaths = ['./plugins'];
        for (const searchPath of defaultSearchPaths) {
          const resolvedPath = path.resolve(searchPath);
          if (fs.existsSync(resolvedPath)) {
            const pluginDirs = fs
              .readdirSync(resolvedPath, { withFileTypes: true })
              .filter((dirent) => dirent.isDirectory())
              .map((dirent) => dirent.name);
            for (const pluginDir of pluginDirs) {
              try {
                const manifestPath = path.join(
                  resolvedPath,
                  pluginDir,
                  'plugin.manifest.json'
                );
                if (fs.existsSync(manifestPath)) {
                  const manifestContent = fs.readFileSync(
                    manifestPath,
                    'utf-8'
                  );
                  const manifest = JSON.parse(manifestContent);
                  const pluginModule = this.createPluginModule(
                    manifest,
                    resolvedPath,
                    pluginDir
                  );
                  if (pluginModule) {
                    pluginModules.push(pluginModule);
                  }
                }
              } catch (error) {
                console.warn(`Failed to process plugin ${pluginDir}:`, error);
              }
            }
          }
        }
        return pluginModules;
      }
      return [];
    } catch (error) {
      console.warn('Could not pre-discover plugin modules:', error);
      return [];
    }
  }

  private static createPluginModule(
    manifest: any,
    basePath: string,
    pluginDir: string
  ): any {
    const require = createRequire(__filename);
    try {
      const distPath = path.join(basePath, pluginDir, 'dist');
      if (!fs.existsSync(distPath)) {
        return null;
      }

      const controllers: any[] = [];
      const providers: any[] = [];
      const exports: any[] = [];
      const pluginDist = require(distPath);
      manifest.module.controllers?.forEach((controllerName: string) => {
        if (pluginDist[controllerName]) {
          const controllerClass = pluginDist[controllerName];
          controllers.push(controllerClass);
        }
      });
      manifest.module.providers?.forEach((providerName: string) => {
        if (pluginDist[providerName]) {
          const providerClass = pluginDist[providerName];
          providers.push(providerClass);
        }
      });

      manifest.module.exports?.forEach((exportName: string) => {
        if (pluginDist[exportName]) {
          const exportClass = pluginDist[exportName];
          exports.push(exportClass);
        }
      });
      if (controllers.length > 0 || providers.length > 0) {
        const DynamicPluginModule = class {};
        Object.defineProperty(DynamicPluginModule, 'name', {
          value: `${manifest.name
            .replace('@plugins/', '')
            .replace(/^[a-z]/, (c: string) => c.toUpperCase())
            .replace(/-/g, '')}Module`,
        });
        return {
          module: DynamicPluginModule,
          controllers,
          providers,
          exports,
        };
      }
      return null;
    } catch (error) {
      console.warn(
        `Failed to create plugin module for ${manifest.name}:`,
        error
      );
      return null;
    }
  }

  private static createCoreProviders(): Provider[] {
    return [
      PluginCore,

      {
        provide: 'PLUGIN_MODULE_REGISTRY',
        useValue: new Map(),
      },

      PluginDiscoveryService,
      PluginLoaderService,
      PluginLoaderFactory,
      PluginLoaderStrategyFactory,
      PluginLoadingStrategyFactory,
      ParallelLoadingStrategyService,
      DefaultPluginLoaderStrategy,
      DynamicPluginModuleGeneratorService,

      PluginLoaderCoordinatorService,
      PluginLoaderCoordinatorFactory,

      PluginOrchestratorService,

      PluginStateManagerService,
      PluginInstantiationService,
      PluginPostLoadVerificationService,

      PluginSecurityManagerService,
      PluginMemoryManagerService,
      PluginDependencyResolverService,
    ];
  }

  private static createCoreExports(): (string | symbol | Type<any>)[] {
    return [
      PluginCore,

      PluginDiscoveryService,
      PluginLoaderService,
      PluginLoaderFactory,
      PluginLoaderStrategyFactory,
      PluginLoadingStrategyFactory,
      ParallelLoadingStrategyService,
      DefaultPluginLoaderStrategy,
      DynamicPluginModuleGeneratorService,

      PluginLoaderCoordinatorService,
      PluginLoaderCoordinatorFactory,

      PluginOrchestratorService,

      PluginStateManagerService,
      PluginInstantiationService,
      PluginPostLoadVerificationService,

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
}
