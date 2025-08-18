import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  PluginLifecycleEventType,
  PluginLifecycleEventData,
  PluginLifecycleEvent,
  PluginLifecycleCallback,
  PluginLifecycleListener,
  PluginLifecycleListenerOptions,
  PluginLifecycleHandler
} from '../types/plugin-lifecycle-types';
import { PluginErrorHandler, PluginErrorCode } from './plugin-error-handler.service';

@Injectable()
export class PluginLifecycleService {
  private readonly logger = new Logger(PluginLifecycleService.name);
  private readonly eventEmitter = new EventEmitter();
  private readonly listeners = new Map<string, PluginLifecycleListener>();
  private listenerIdCounter = 0;

  constructor() {
    // Set max listeners to prevent memory leak warnings in large plugin systems
    this.eventEmitter.setMaxListeners(1000);
  }

  /**
   * Register a lifecycle event listener
   */
  on(
    eventType: PluginLifecycleEventType,
    callback: PluginLifecycleCallback,
    options?: PluginLifecycleListenerOptions
  ): string {
    const listenerId = `listener_${++this.listenerIdCounter}`;
    
    const listener: PluginLifecycleListener = {
      id: listenerId,
      eventType,
      callback,
      options,
      registeredAt: new Date()
    };

    this.listeners.set(listenerId, listener);

    const wrappedCallback = async (event: PluginLifecycleEvent) => {
      try {
        // Apply filter if specified
        if (options?.filter && !options.filter(event)) {
          return;
        }

        await callback(event);

        // Remove listener if it's a once-only listener
        if (options?.once) {
          this.off(listenerId);
        }
      } catch (error) {
        this.logger.error(`Error in lifecycle listener ${listenerId}:`, error);
        PluginErrorHandler.handleError(
          PluginErrorHandler.createError(
            PluginErrorCode.LOADING_FAILED,
            `Lifecycle listener error: ${error}`,
            event.data.pluginName,
            'lifecycle',
            error
          )
        );
      }
    };

    if (options?.once) {
      this.eventEmitter.once(eventType, wrappedCallback);
    } else {
      this.eventEmitter.on(eventType, wrappedCallback);
    }

    this.logger.debug(`Registered lifecycle listener ${listenerId} for event ${eventType}`);
    return listenerId;
  }

  /**
   * Remove a lifecycle event listener
   */
  off(listenerId: string): boolean {
    const listener = this.listeners.get(listenerId);
    if (!listener) {
      return false;
    }

    this.eventEmitter.removeAllListeners(listener.eventType);
    this.listeners.delete(listenerId);
    
    this.logger.debug(`Removed lifecycle listener ${listenerId}`);
    return true;
  }

  /**
   * Emit a lifecycle event
   */
  async emit(eventType: PluginLifecycleEventType, data: PluginLifecycleEventData): Promise<void> {
    const event: PluginLifecycleEvent = {
      type: eventType,
      data: {
        ...data,
        timestamp: data.timestamp || new Date()
      }
    };

    this.logger.debug(`Emitting lifecycle event ${eventType} for plugin ${data.pluginName}`);

    // Call plugin's lifecycle handler if it implements the interface
    if (data.instance && this.implementsLifecycleHandler(data.instance)) {
      await this.callPluginLifecycleHandler(data.instance, eventType, event);
    }

    // Emit to registered listeners
    this.eventEmitter.emit(eventType, event);

    // Also emit to global listeners
    this.eventEmitter.emit('*', event);
  }

  /**
   * Get all registered listeners
   */
  getListeners(eventType?: PluginLifecycleEventType): PluginLifecycleListener[] {
    const allListeners = Array.from(this.listeners.values());
    
    if (eventType) {
      return allListeners.filter(listener => listener.eventType === eventType);
    }
    
    return allListeners;
  }

  /**
   * Get listener count for specific event type
   */
  getListenerCount(eventType: PluginLifecycleEventType): number {
    return this.eventEmitter.listenerCount(eventType);
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    this.eventEmitter.removeAllListeners();
    this.listeners.clear();
    this.logger.debug('Cleared all lifecycle listeners');
  }

  /**
   * Check if an object implements PluginLifecycleHandler
   */
  private implementsLifecycleHandler(obj: any): obj is PluginLifecycleHandler {
    return obj && (
      typeof obj.onLoad === 'function' ||
      typeof obj.onUnload === 'function' ||
      typeof obj.onEnable === 'function' ||
      typeof obj.onDisable === 'function' ||
      typeof obj.onError === 'function'
    );
  }

  /**
   * Call appropriate lifecycle handler method on plugin instance
   */
  private async callPluginLifecycleHandler(
    instance: PluginLifecycleHandler,
    eventType: PluginLifecycleEventType,
    event: PluginLifecycleEvent
  ): Promise<void> {
    try {
      switch (eventType) {
        case 'load':
          if (instance.onLoad) {
            await instance.onLoad();
          }
          break;
        case 'unload':
          if (instance.onUnload) {
            await instance.onUnload();
          }
          break;
        case 'enable':
          if (instance.onEnable) {
            await instance.onEnable();
          }
          break;
        case 'disable':
          if (instance.onDisable) {
            await instance.onDisable();
          }
          break;
        case 'error':
          if (instance.onError && event.data.error) {
            await instance.onError(event.data.error);
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Error calling plugin lifecycle handler for ${eventType}:`, error);
      PluginErrorHandler.handleError(
        PluginErrorHandler.createError(
          PluginErrorCode.LOADING_FAILED,
          `Plugin lifecycle handler error: ${error}`,
          event.data.pluginName,
          'lifecycle',
          error
        )
      );
    }
  }

  /**
   * Get lifecycle event statistics
   */
  getLifecycleStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalListeners: this.listeners.size,
      listenersByEvent: {},
      oldestListener: null,
      newestListener: null
    };

    // Count listeners by event type
    for (const listener of this.listeners.values()) {
      if (!stats.listenersByEvent[listener.eventType]) {
        stats.listenersByEvent[listener.eventType] = 0;
      }
      stats.listenersByEvent[listener.eventType]++;
    }

    // Find oldest and newest listeners
    const sortedListeners = Array.from(this.listeners.values())
      .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());
    
    if (sortedListeners.length > 0) {
      stats.oldestListener = {
        id: sortedListeners[0].id,
        eventType: sortedListeners[0].eventType,
        registeredAt: sortedListeners[0].registeredAt
      };
      stats.newestListener = {
        id: sortedListeners[sortedListeners.length - 1].id,
        eventType: sortedListeners[sortedListeners.length - 1].eventType,
        registeredAt: sortedListeners[sortedListeners.length - 1].registeredAt
      };
    }

    return stats;
  }
}