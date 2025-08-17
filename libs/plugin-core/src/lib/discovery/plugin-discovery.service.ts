import { Injectable, Logger } from '@nestjs/common';
import { PluginManifest } from '../types/plugin-strict-interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);

  async discoverPlugins(searchPaths: string[]): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    for (const searchPath of searchPaths) {
      try {
        const discovered = await this.discoverPluginsInPath(searchPath);
        manifests.push(...discovered);
      } catch (error) {
        this.logger.error(`Failed to discover plugins in ${searchPath}`, error);
      }
    }

    return manifests;
  }

  private async discoverPluginsInPath(searchPath: string): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    try {
      const entries = await fs.readdir(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(searchPath, entry.name);
          const manifestPath = path.join(pluginPath, 'plugin.manifest.json');

          try {
            await fs.access(manifestPath);
            const manifest = await this.loadManifest(manifestPath);
            if (manifest) {
              manifests.push(manifest);
            }
          } catch {
            // No plugin.json found, skip
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error reading directory ${searchPath}`, error);
    }

    return manifests;
  }

  private async loadManifest(manifestPath: string): Promise<PluginManifest | null> {
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const rawManifest = JSON.parse(content);

      if (!this.validateManifest(rawManifest)) {
        this.logger.warn(`Invalid manifest at ${manifestPath}`);
        return null;
      }

      // Transform new format to expected PluginManifest structure
      const manifest: PluginManifest = this.transformManifest(rawManifest, manifestPath);
      return manifest;
    } catch (error) {
      this.logger.error(`Failed to load manifest from ${manifestPath}`, error);
      return null;
    }
  }

  private transformManifest(rawManifest: any, manifestPath: string): PluginManifest {
    // If it's already in the old format, return as is
    if (rawManifest.plugin && rawManifest.entryPoint) {
      return rawManifest as PluginManifest;
    }

    // Transform new format to current PluginManifest structure
    const pluginDir = path.dirname(manifestPath);
    const entryPoint = path.join(pluginDir, 'dist', 'index.js');
    
    return {
      // Plugin properties (PluginManifest extends Plugin)
      id: rawManifest.name || 'unknown',
      name: rawManifest.name || 'Unknown Plugin',
      version: rawManifest.version || '0.0.0',
      description: rawManifest.description,
      author: rawManifest.author || 'Unknown',
      license: rawManifest.license || 'Unknown',
      keywords: rawManifest.keywords || [],
      dependencies: rawManifest.dependencies || [],
      metadata: {},
      
      // PluginManifest specific properties
      loadOrder: rawManifest.loadOrder || 0,
      critical: rawManifest.critical || false,
      entryPoint: entryPoint,
      exports: rawManifest.module?.exports || [],
      permissions: rawManifest.permissions || {},
      module: rawManifest.module || {},
      security: rawManifest.security,
      compatibility: rawManifest.compatibility
    };
  }

  private validateManifest(manifest: any): manifest is PluginManifest {
    // Handle new manifest format (direct properties)
    if (manifest && typeof manifest.name === 'string' && typeof manifest.version === 'string') {
      return true;
    }
    
    // Handle old manifest format (nested plugin object)
    return (
      manifest &&
      manifest.plugin &&
      typeof manifest.id === 'string' &&
      typeof manifest.name === 'string' &&
      typeof manifest.version === 'string' &&
      typeof manifest.entryPoint === 'string'
    );
  }
}