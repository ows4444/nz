import { Injectable, Logger } from '@nestjs/common';
import { PluginState } from '../types/plugin-strict-interfaces';

@Injectable()
export class PluginStateManagerService {
  private readonly logger = new Logger(PluginStateManagerService.name);
  private readonly pluginStates = new Map<string, PluginState>();
  private readonly stateHistory = new Map<string, PluginState[]>();

  async transitionState(pluginId: string, newState: PluginState): Promise<boolean> {
    const currentState = this.getState(pluginId);
    
    if (!this.isValidTransition(currentState, newState)) {
      this.logger.error(`Invalid state transition for plugin ${pluginId}: ${currentState} -> ${newState}`);
      return false;
    }

    this.pluginStates.set(pluginId, newState);
    this.addToHistory(pluginId, newState);
    
    this.logger.log(`Plugin ${pluginId} transitioned from ${currentState} to ${newState}`);
    return true;
  }

  getState(pluginId: string): PluginState {
    return this.pluginStates.get(pluginId) || PluginState.UNLOADED;
  }

  getAllStates(): Map<string, PluginState> {
    return new Map(this.pluginStates);
  }

  getStateHistory(pluginId: string): PluginState[] {
    return this.stateHistory.get(pluginId) || [];
  }

  resetState(pluginId: string): void {
    this.pluginStates.set(pluginId, PluginState.UNLOADED);
    this.stateHistory.delete(pluginId);
    this.logger.log(`Reset state for plugin ${pluginId}`);
  }

  isInState(pluginId: string, state: PluginState): boolean {
    return this.getState(pluginId) === state;
  }

  getPluginsInState(state: PluginState): string[] {
    const pluginsInState: string[] = [];
    for (const [pluginId, pluginState] of this.pluginStates.entries()) {
      if (pluginState === state) {
        pluginsInState.push(pluginId);
      }
    }
    return pluginsInState;
  }

  private isValidTransition(currentState: PluginState, newState: PluginState): boolean {
    const validTransitions: Record<PluginState, PluginState[]> = {
      [PluginState.UNLOADED]: [PluginState.LOADING],
      [PluginState.LOADING]: [PluginState.LOADED, PluginState.ERROR, PluginState.FAILED],
      [PluginState.LOADED]: [PluginState.STARTING, PluginState.UNLOADING, PluginState.ERROR],
      [PluginState.STARTING]: [PluginState.RUNNING, PluginState.ERROR, PluginState.FAILED],
      [PluginState.RUNNING]: [PluginState.STOPPING, PluginState.ERROR, PluginState.UNLOADING],
      [PluginState.STOPPING]: [PluginState.STOPPED, PluginState.ERROR],
      [PluginState.STOPPED]: [PluginState.STARTING, PluginState.UNLOADING],
      [PluginState.ERROR]: [PluginState.LOADING, PluginState.UNLOADING],
      [PluginState.FAILED]: [PluginState.LOADING, PluginState.UNLOADING],
      [PluginState.UNLOADING]: [PluginState.UNLOADED, PluginState.ERROR]
    };

    const allowedStates = validTransitions[currentState];
    return allowedStates ? allowedStates.includes(newState) : false;
  }

  private addToHistory(pluginId: string, state: PluginState): void {
    if (!this.stateHistory.has(pluginId)) {
      this.stateHistory.set(pluginId, []);
    }
    
    const history = this.stateHistory.get(pluginId)!;
    history.push(state);
    
    // Keep only last 10 states
    if (history.length > 10) {
      history.shift();
    }
  }
}