import { PluginState, PluginInstance } from './plugin-strict-interfaces';

/**
 * Interface for orchestrating plugin lifecycle operations
 */
export interface PluginOrchestrator {
  orchestratePluginLifecycle(pluginId: string): Promise<boolean>;
  startPlugin(pluginId: string): Promise<boolean>;
  stopPlugin(pluginId: string): Promise<boolean>;
  restartPlugin(pluginId: string): Promise<boolean>;
  getPluginState(pluginId: string): PluginState;
  getPluginInstance(pluginId: string): PluginInstance | undefined;
  getAllPluginStates(): Map<string, PluginState>;
  getAllPluginInstances(): Map<string, PluginInstance>;
  onPluginStateChange(callback: (pluginId: string, oldState: PluginState, newState: PluginState) => void): void;
  healthCheck(pluginId?: string): Promise<Map<string, boolean>>;
}