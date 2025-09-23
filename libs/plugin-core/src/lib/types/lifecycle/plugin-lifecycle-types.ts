import { PluginManifest } from '../core/plugin-strict-interfaces';
import { PluginComponentInstance } from '../components/plugin-component-types';

/**
 * Plugin lifecycle event types
 */
export type PluginLifecycleEventType = 'load' | 'unload' | 'enable' | 'disable' | 'error';

/**
 * Plugin lifecycle event data
 */
export interface PluginLifecycleEventData<T extends PluginComponentInstance = PluginComponentInstance> {
  pluginName: string;
  manifest?: PluginManifest;
  instance?: T;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Plugin lifecycle event
 */
export interface PluginLifecycleEvent<T extends PluginComponentInstance = PluginComponentInstance> {
  type: PluginLifecycleEventType;
  data: PluginLifecycleEventData<T>;
}

/**
 * Plugin lifecycle callback function
 */
export type PluginLifecycleCallback<T extends PluginComponentInstance = PluginComponentInstance> = (event: PluginLifecycleEvent<T>) => void | Promise<void>;

/**
 * Plugin lifecycle listener options
 */
export interface PluginLifecycleListenerOptions<T extends PluginComponentInstance = PluginComponentInstance> {
  once?: boolean;
  priority?: number;
  filter?: (event: PluginLifecycleEvent<T>) => boolean;
}

/**
 * Plugin lifecycle listener entry
 */
export interface PluginLifecycleListener<T extends PluginComponentInstance = PluginComponentInstance> {
  id: string;
  eventType: PluginLifecycleEventType;
  callback: PluginLifecycleCallback<T>;
  options?: PluginLifecycleListenerOptions<T>;
  registeredAt: Date;
}

/**
 * Interface that plugins can implement to handle lifecycle events
 */
export interface PluginLifecycleHandler {
  onLoad?(): Promise<void> | void;
  onUnload?(): Promise<void> | void;
  onEnable?(): Promise<void> | void;
  onDisable?(): Promise<void> | void;
  onError?(error: Error): Promise<void> | void;
}
