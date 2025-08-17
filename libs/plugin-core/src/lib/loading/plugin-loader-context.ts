import { PluginManifest, PluginLoadOptions, PluginSecurityContext } from '../types/plugin-strict-interfaces';

export class PluginLoaderContext {
  constructor(
    public readonly manifest: PluginManifest,
    public readonly options: PluginLoadOptions = {},
    public readonly security: PluginSecurityContext | null = null
  ) {}

  withSecurity(security: PluginSecurityContext): PluginLoaderContext {
    return new PluginLoaderContext(this.manifest, this.options, security);
  }

  withOptions(options: PluginLoadOptions): PluginLoaderContext {
    return new PluginLoaderContext(this.manifest, { ...this.options, ...options }, this.security);
  }

  getTimeout(): number {
    return this.options.timeout || 30000;
  }

  getRetries(): number {
    return this.options.retries || 3;
  }

  isParallelLoadingEnabled(): boolean {
    return this.options.parallel || false;
  }
}