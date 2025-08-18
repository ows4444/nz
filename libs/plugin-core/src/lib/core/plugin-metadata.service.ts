import { Injectable, Logger } from '@nestjs/common';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DiscoveryService } from '@nestjs/core';
import { Plugin, PLUGIN_META_KEY } from '../types/plugin-core-config.interface';
import 'reflect-metadata';

export interface PluginMetadataInfo {
  name?: string;
  enabled?: boolean;
}

export interface PluginWrapper {
  wrapper: InstanceWrapper;
  metadata: PluginMetadataInfo;
  type: 'provider' | 'controller';
}

@Injectable()
export class PluginMetadataService {
  private readonly logger = new Logger(PluginMetadataService.name);

  constructor(private readonly discoveryService: DiscoveryService) {}

  findAllPluginWrappers(): PluginWrapper[] {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();

    const pluginWrappers: PluginWrapper[] = [];

    // Process providers
    for (const wrapper of providers) {
      const metadata = this.extractPluginMetadata(wrapper);
      if (metadata) {
        pluginWrappers.push({ wrapper, metadata, type: 'provider' });
      }
    }

    // Process controllers
    for (const wrapper of controllers) {
      const metadata = this.extractPluginMetadata(wrapper);
      if (metadata) {
        pluginWrappers.push({ wrapper, metadata, type: 'controller' });
      }
    }

    return pluginWrappers;
  }

  private extractPluginMetadata(wrapper: InstanceWrapper): PluginMetadataInfo | null {
    const nestMetadata = this.discoveryService.getMetadataByDecorator(Plugin as any, wrapper);
    const directMetadata = wrapper.metatype ? Reflect.getMetadata(PLUGIN_META_KEY, wrapper.metatype) : null;

    return nestMetadata || directMetadata || null;
  }

  updatePluginMetadata(wrapper: InstanceWrapper, metadata: PluginMetadataInfo): void {
    if (wrapper.metatype && metadata) {
      const updatedMetadata = { ...metadata, enabled: false };
      Reflect.defineMetadata(PLUGIN_META_KEY, updatedMetadata, wrapper.metatype);
      this.logger.log(`Updated plugin metadata for: ${wrapper.metatype.name}`, updatedMetadata);
    }
  }
}
