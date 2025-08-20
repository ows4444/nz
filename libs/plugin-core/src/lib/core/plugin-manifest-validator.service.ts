import { createRequire } from 'module';
import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PluginManifest } from '../types/core/plugin-strict-interfaces';
import { IPluginManifestValidator } from '../types/services/plugin-service-interfaces';
import { PLUGIN_CONSTANTS } from '../constants';
import { DtoOrchestratorService } from '@libs/dynamic-dto';

@Injectable()
export class PluginManifestValidator implements IPluginManifestValidator {
  constructor(@Optional() private readonly _dtoOrchestratorService?: DtoOrchestratorService) {}
  private readonly logger = new Logger(PluginManifestValidator.name);
  private readonly require = createRequire(__filename);

  validateManifest(manifest: unknown, pluginDir: string): manifest is PluginManifest {
    if (!this.isObject(manifest)) {
      this.logger.warn(`Invalid manifest structure for plugin in ${pluginDir}: not an object`);
      return false;
    }

    const manifestObj = manifest as Record<string, unknown>;

    if (!manifestObj.name || typeof manifestObj.name !== 'string') {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: missing or invalid name`);
      return false;
    }

    if (!manifestObj.module || !this.isObject(manifestObj.module)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: missing or invalid module`);
      return false;
    }

    return true;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // Static methods for backward compatibility
  static validateManifest(manifest: unknown, pluginDir: string): manifest is PluginManifest {
    const instance = new PluginManifestValidator();
    return instance.validateManifest(manifest, pluginDir);
  }

  loadAndValidateManifest(manifestPath: string, pluginDir: string): PluginManifest | null {
    if (!manifestPath || !pluginDir) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_PARAMETERS}: manifestPath and pluginDir are required`);
      return null;
    }

    if (!fs.existsSync(manifestPath)) {
      this.logger.debug(`No manifest found for plugin: ${pluginDir}`);
      return null;
    }

    try {
      const manifest = this.require(manifestPath);
      if (!this.validateManifest(manifest, pluginDir)) {
        return null;
      }
      this.logger.debug(`Valid manifest found for plugin: ${pluginDir}`);
      return manifest as PluginManifest;
    } catch (error) {
      this.logger.warn(`Failed to parse manifest for plugin ${pluginDir}:`, error);
      return null;
    }
  }

  static loadAndValidateManifest(manifestPath: string, pluginDir: string): PluginManifest | null {
    const instance = new PluginManifestValidator();
    return instance.loadAndValidateManifest(manifestPath, pluginDir);
  }

  discoverValidPluginDirs(resolvedPath: string, pluginPaths: string[]): string[] {
    if (!resolvedPath || !Array.isArray(pluginPaths)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_PARAMETERS}: resolvedPath must be a string and pluginPaths must be an array`);
      return [];
    }

    this.logger.log(`Discovering plugins in paths: ${pluginPaths.join(', ')}`);
    const pluginDirs: string[] = [];

    for (const pluginDir of pluginPaths) {
      if (!pluginDir || typeof pluginDir !== 'string') {
        this.logger.warn(`Skipping invalid plugin directory: ${pluginDir}`);
        continue;
      }

      const manifestPath = path.join(resolvedPath, pluginDir, PLUGIN_CONSTANTS.MANIFEST_FILE);
      const manifest = this.loadAndValidateManifest(manifestPath, pluginDir);

      if (manifest) {
        pluginDirs.push(pluginDir);
      }
    }

    pluginDirs.sort((a, b) => a.localeCompare(b));

    if (pluginDirs.length === 0) {
      this.logger.warn(PLUGIN_CONSTANTS.ERRORS.NO_VALID_PLUGINS);
    } else {
      this.logger.log(`Found ${pluginDirs.length} valid plugins: ${pluginDirs.join(', ')}`);
    }

    return pluginDirs;
  }

  static discoverValidPluginDirs(resolvedPath: string, pluginPaths: string[]): string[] {
    const instance = new PluginManifestValidator();
    return instance.discoverValidPluginDirs(resolvedPath, pluginPaths);
  }
}
