import { Injectable, Logger } from '@nestjs/common';
import { PluginOrchestrator } from '../types/plugin-orchestrator.interface';
import { PluginState, PluginInstance } from '../types/plugin-strict-interfaces';
import { PluginStateManagerService } from '../lifecycle/plugin-state-manager.service';
import { PluginLoaderCoordinatorService } from '../registry/plugin-loader-coordinator.service';

@Injectable()
export class PluginOrchestratorService implements PluginOrchestrator {
  private readonly logger = new Logger(PluginOrchestratorService.name);
  private readonly stateChangeCallbacks: Array<(pluginId: string, oldState: PluginState, newState: PluginState) => void> = [];

  constructor(
    private readonly stateManager: PluginStateManagerService,
    private readonly coordinator: PluginLoaderCoordinatorService
  ) {}

  async orchestratePluginLifecycle(pluginId: string): Promise<boolean> {
    try {
      this.logger.log(`Orchestrating lifecycle for plugin ${pluginId}`);

      const currentState = this.getPluginState(pluginId);
      
      switch (currentState) {
        case PluginState.UNLOADED:
          return await this.startPlugin(pluginId);
        case PluginState.LOADED:
          return await this.startPlugin(pluginId);
        case PluginState.RUNNING:
          this.logger.log(`Plugin ${pluginId} is already running`);
          return true;
        case PluginState.STOPPED:
          return await this.startPlugin(pluginId);
        case PluginState.ERROR:
          return await this.restartPlugin(pluginId);
        default:
          this.logger.warn(`Unknown state ${currentState} for plugin ${pluginId}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to orchestrate lifecycle for plugin ${pluginId}`, error);
      return false;
    }
  }

  async startPlugin(pluginId: string): Promise<boolean> {
    try {
      const oldState = this.getPluginState(pluginId);
      
      if (oldState === PluginState.RUNNING) {
        this.logger.log(`Plugin ${pluginId} is already running`);
        return true;
      }

      await this.stateManager.transitionState(pluginId, PluginState.LOADING);
      
      const pluginInstance = this.coordinator.getPluginInstance(pluginId);
      if (!pluginInstance) {
        this.logger.error(`Plugin ${pluginId} not found`);
        await this.stateManager.transitionState(pluginId, PluginState.ERROR);
        return false;
      }

      // Start the plugin instance
      if (pluginInstance.instance && 
          typeof pluginInstance.instance === 'object' &&
          'start' in pluginInstance.instance &&
          typeof (pluginInstance.instance as any).start === 'function') {
        await (pluginInstance.instance as any).start();
      }

      await this.stateManager.transitionState(pluginId, PluginState.RUNNING);
      this.notifyStateChange(pluginId, oldState, PluginState.RUNNING);
      
      this.logger.log(`Successfully started plugin ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to start plugin ${pluginId}`, error);
      await this.stateManager.transitionState(pluginId, PluginState.ERROR);
      return false;
    }
  }

  async stopPlugin(pluginId: string): Promise<boolean> {
    try {
      const oldState = this.getPluginState(pluginId);
      
      if (oldState === PluginState.STOPPED) {
        this.logger.log(`Plugin ${pluginId} is already stopped`);
        return true;
      }

      const pluginInstance = this.coordinator.getPluginInstance(pluginId);
      if (!pluginInstance) {
        this.logger.error(`Plugin ${pluginId} not found`);
        return false;
      }

      // Stop the plugin instance
      if (pluginInstance.instance && 
          typeof pluginInstance.instance === 'object' &&
          'stop' in pluginInstance.instance &&
          typeof (pluginInstance.instance as any).stop === 'function') {
        await (pluginInstance.instance as any).stop();
      }

      await this.stateManager.transitionState(pluginId, PluginState.STOPPED);
      this.notifyStateChange(pluginId, oldState, PluginState.STOPPED);
      
      this.logger.log(`Successfully stopped plugin ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop plugin ${pluginId}`, error);
      await this.stateManager.transitionState(pluginId, PluginState.ERROR);
      return false;
    }
  }

  async restartPlugin(pluginId: string): Promise<boolean> {
    this.logger.log(`Restarting plugin ${pluginId}`);
    
    const stopResult = await this.stopPlugin(pluginId);
    if (!stopResult) {
      return false;
    }

    // Wait a moment before starting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await this.startPlugin(pluginId);
  }

  getPluginState(pluginId: string): PluginState {
    return this.stateManager.getState(pluginId);
  }

  getAllPluginStates(): Map<string, PluginState> {
    return this.stateManager.getAllStates();
  }

  onPluginStateChange(callback: (pluginId: string, oldState: PluginState, newState: PluginState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  getPluginInstance(pluginId: string): PluginInstance | undefined {
    return this.coordinator.getPluginInstance(pluginId);
  }

  getAllPluginInstances(): Map<string, PluginInstance> {
    const instances = new Map<string, PluginInstance>();
    const pluginIds = this.coordinator.getLoadedPlugins();
    
    for (const pluginId of pluginIds) {
      const instance = this.coordinator.getPluginInstance(pluginId);
      if (instance) {
        instances.set(pluginId, instance);
      }
    }
    
    return instances;
  }

  async healthCheck(pluginId?: string): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();
    
    if (pluginId) {
      const instance = this.coordinator.getPluginInstance(pluginId);
      if (instance && instance.instance && typeof instance.instance === 'object' && 'healthCheck' in instance.instance) {
        try {
          const result = await (instance.instance as any).healthCheck();
          healthStatus.set(pluginId, Boolean(result));
        } catch {
          healthStatus.set(pluginId, false);
        }
      } else {
        healthStatus.set(pluginId, this.getPluginState(pluginId) === PluginState.RUNNING);
      }
    } else {
      const pluginIds = this.coordinator.getLoadedPlugins();
      for (const id of pluginIds) {
        const result = await this.healthCheck(id);
        healthStatus.set(id, result.get(id) || false);
      }
    }
    
    return healthStatus;
  }

  private notifyStateChange(pluginId: string, oldState: PluginState, newState: PluginState): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(pluginId, oldState, newState);
      } catch (error) {
        this.logger.error('Error in state change callback', error);
      }
    }
  }
}