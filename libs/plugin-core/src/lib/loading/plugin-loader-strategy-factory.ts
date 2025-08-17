import { Injectable } from '@nestjs/common';
import { PluginLoaderStrategy } from '../types/plugin-loader-strategy.interface';

@Injectable()
export class PluginLoaderStrategyFactory {
  private readonly strategies = new Map<string, () => PluginLoaderStrategy>();

  registerStrategyFactory(type: string, factory: () => PluginLoaderStrategy): void {
    this.strategies.set(type, factory);
  }

  createStrategy(type: string): PluginLoaderStrategy | null {
    const factory = this.strategies.get(type);
    return factory ? factory() : null;
  }

  getSupportedTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  hasStrategy(type: string): boolean {
    return this.strategies.has(type);
  }
}