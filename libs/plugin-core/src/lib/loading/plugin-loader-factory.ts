import { Injectable } from '@nestjs/common';
import { PluginLoaderStrategy } from '../types/plugin-loader-strategy.interface';
import { PluginLoaderService } from './plugin-loader.service';

@Injectable()
export class PluginLoaderFactory {
  constructor(private readonly loaderService: PluginLoaderService) {}

  createLoader(strategies: Map<string, PluginLoaderStrategy>): PluginLoaderService {
    const loader = new PluginLoaderService();
    
    for (const [type, strategy] of strategies.entries()) {
      loader.registerStrategy(type, strategy);
    }
    
    return loader;
  }

  registerStrategy(type: string, strategy: PluginLoaderStrategy): void {
    this.loaderService.registerStrategy(type, strategy);
  }
}