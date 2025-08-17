import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { PluginDiscoveryService } from '../discovery/plugin-discovery.service';
import { PluginLoaderCoordinatorService } from '../registry/plugin-loader-coordinator.service';
import { PluginOrchestratorService } from '../registry/plugin-orchestrator.service';
import { PluginMemoryManagerService } from '../security/plugin-memory-manager.service';
import { PluginLoaderService } from '../loading/plugin-loader.service';
import { DefaultPluginLoaderStrategy } from '../loading/default-plugin-loader-strategy.service';
import { PluginManifest, PluginLoadResult, PluginState } from '../types/plugin-strict-interfaces';
import type { PluginCoreConfig } from '../types/plugin-core-config.interface';
import { PLUGIN_CORE_CONFIG } from '../types/plugin-core-config.interface';

@Injectable()
export class PluginCore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PluginCore.name);

  constructor(
    private readonly discoveryService: PluginDiscoveryService,
    private readonly coordinatorService: PluginLoaderCoordinatorService,
    private readonly orchestratorService: PluginOrchestratorService,
    private readonly memoryManagerService: PluginMemoryManagerService,
    private readonly loaderService: PluginLoaderService,
    private readonly defaultStrategy: DefaultPluginLoaderStrategy,
    @Optional() @Inject(PLUGIN_CORE_CONFIG) private readonly config: PluginCoreConfig = {}
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Plugin Core Service');
    
    // Register default plugin loader strategy
    this.loaderService.registerStrategy('default', this.defaultStrategy);
    
    // Start memory monitoring if enabled
    if (this.config.enableMemoryMonitoring !== false) {
      this.memoryManagerService.startMonitoring();
    }
    
    // Set up orchestrator state change listener
    this.orchestratorService.onPluginStateChange((pluginId, oldState, newState) => {
      this.logger.log(`Plugin ${pluginId} state changed: ${oldState} -> ${newState}`);
    });

    // Auto-discover and load plugins if searchPaths are configured
    // Note: If plugins are pre-loaded in PluginCoreModule, this will be skipped
    if (this.config.searchPaths && this.config.searchPaths.length > 0 && !this.config.skipRuntimeLoading) {
      this.logger.log(`Starting plugin discovery and loading from paths: ${this.config.searchPaths.join(', ')}`);
      await this.discoverAndLoadPlugins(this.config.searchPaths);
    } else if (this.config.skipRuntimeLoading) {
      this.logger.log('Runtime plugin loading skipped - plugins should be pre-loaded in module imports');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Plugin Core Service');
    await this.coordinatorService.unloadAllPlugins();
    this.memoryManagerService.stopMonitoring();
  }

  async discoverAndLoadPlugins(searchPaths: string[]): Promise<PluginLoadResult[]> {
    try {
      this.logger.log(`Discovering plugins in paths: ${searchPaths.join(', ')}`);
      
      const manifests = await this.discoveryService.discoverPlugins(searchPaths);
      this.logger.log(`Discovered ${manifests.length} plugins`);

      if (manifests.length === 0) {
        return [];
      }

      const loadOptions = {
        timeout: this.config.defaultTimeout,
        retries: this.config.defaultRetries,
        parallel: this.config.parallelLoading
      };

      const results = await this.coordinatorService.loadPlugins(manifests, loadOptions);
      
      // Start all successfully loaded plugins if autoStart is enabled
      if (this.config.autoStart !== false) {
        for (const result of results) {
          if (result.success && result.plugin) {
            await this.orchestratorService.startPlugin(result.plugin.plugin.id);
          }
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to discover and load plugins', error);
      throw error;
    }
  }

  async loadPlugin(manifest: PluginManifest): Promise<PluginLoadResult> {
    try {
      const loadOptions = {
        timeout: this.config.defaultTimeout,
        retries: this.config.defaultRetries,
        parallel: this.config.parallelLoading
      };

      const result = await this.coordinatorService.loadPlugin(manifest, loadOptions);
      
      if (result.success && result.plugin && this.config.autoStart !== false) {
        await this.orchestratorService.startPlugin(result.plugin.plugin.id);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to load plugin ${manifest.id}`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      await this.orchestratorService.stopPlugin(pluginId);
      return await this.coordinatorService.unloadPlugin(pluginId);
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}`, error);
      return false;
    }
  }

  async restartPlugin(pluginId: string): Promise<boolean> {
    return await this.orchestratorService.restartPlugin(pluginId);
  }

  getLoadedPlugins(): string[] {
    return this.coordinatorService.getLoadedPlugins();
  }

  getPluginState(pluginId: string): PluginState {
    return this.orchestratorService.getPluginState(pluginId);
  }

  getAllPluginStates(): Map<string, PluginState> {
    return this.orchestratorService.getAllPluginStates();
  }

  getMemoryReport() {
    return this.memoryManagerService.generateMemoryReport();
  }

  isPluginLoaded(pluginId: string): boolean {
    return this.coordinatorService.isPluginLoaded(pluginId);
  }

  getConfiguration(): PluginCoreConfig {
    return { ...this.config };
  }

  async discoverPluginsOnly(searchPaths: string[]): Promise<PluginManifest[]> {
    return await this.discoveryService.discoverPlugins(searchPaths);
  }
}
