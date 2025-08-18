import { PluginManifest } from './plugin-strict-interfaces';

/**
 * Plugin lifecycle event types
 */
export type PluginLifecycleEventType = 'load' | 'unload' | 'enable' | 'disable' | 'error';

/**
 * Plugin lifecycle event data
 */
export interface PluginLifecycleEventData {
  pluginName: string;
  manifest?: PluginManifest;
  instance?: any;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
}

/**
 * Plugin lifecycle event
 */
export interface PluginLifecycleEvent {
  type: PluginLifecycleEventType;
  data: PluginLifecycleEventData;
}

/**
 * Plugin lifecycle callback function
 */
export type PluginLifecycleCallback = (event: PluginLifecycleEvent) => void | Promise<void>;

/**
 * Plugin lifecycle listener options
 */
export interface PluginLifecycleListenerOptions {
  once?: boolean;
  priority?: number;
  filter?: (event: PluginLifecycleEvent) => boolean;
}

/**
 * Plugin lifecycle listener entry
 */
export interface PluginLifecycleListener {
  id: string;
  eventType: PluginLifecycleEventType;
  callback: PluginLifecycleCallback;
  options?: PluginLifecycleListenerOptions;
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