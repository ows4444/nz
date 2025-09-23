import { createRequire } from 'module';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PluginManifest } from '../types/core/plugin-strict-interfaces';
import { IPluginManifestValidator } from '../types/services/plugin-service-interfaces';
import { PLUGIN_CONSTANTS } from '../constants';
import { SemverValidator } from '../utils/semver-validator';

@Injectable()
export class PluginManifestValidator implements IPluginManifestValidator {
  private readonly logger = new Logger(PluginManifestValidator.name);
  private readonly require = createRequire(__filename);
  private readonly semverValidator = new SemverValidator();

  validateManifest(manifest: unknown, pluginDir: string): manifest is PluginManifest {
    if (!this.isObject(manifest)) {
      this.logger.warn(`Invalid manifest structure for plugin in ${pluginDir}: not an object`);
      return false;
    }

    const manifestObj = manifest as Record<string, unknown>;

    // Validate required fields
    if (!manifestObj.name || typeof manifestObj.name !== 'string') {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: missing or invalid name`);
      return false;
    }

    if (!manifestObj.module || !this.isObject(manifestObj.module)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: missing or invalid module`);
      return false;
    }

    // Validate version field
    if (!manifestObj.version || typeof manifestObj.version !== 'string') {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: missing or invalid version`);
      return false;
    }

    // Validate semantic version format
    if (!this.semverValidator.isValidSemver(manifestObj.version)) {
      this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: invalid semantic version format '${manifestObj.version}'`);
      return false;
    }

    // Validate dependencies if present
    if (manifestObj.dependencies) {
      if (!Array.isArray(manifestObj.dependencies)) {
        this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: dependencies must be an array`);
        return false;
      }

      // For backward compatibility, check if dependencies are simple strings (plugin names)
      // or objects with version constraints
      for (let i = 0; i < manifestObj.dependencies.length; i++) {
        const dep = manifestObj.dependencies[i];
        if (typeof dep === 'string') {
          // Simple dependency - just plugin name, no version constraint
          continue;
        } else if (this.isObject(dep)) {
          // Complex dependency with version constraint
          const depObj = dep as Record<string, unknown>;
          if (!depObj.name || typeof depObj.name !== 'string') {
            this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: dependency at index ${i} missing or invalid name`);
            return false;
          }
          if (depObj.version && typeof depObj.version === 'string') {
            if (!this.semverValidator.isValidVersionRange(depObj.version)) {
              this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: dependency '${depObj.name}' has invalid version range '${depObj.version}'`);
              return false;
            }
          }
        } else {
          this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: dependency at index ${i} must be a string or object`);
          return false;
        }
      }
    }

    // Validate compatibility constraints if present
    if (manifestObj.compatibility && this.isObject(manifestObj.compatibility)) {
      const compatibility = manifestObj.compatibility as Record<string, unknown>;

      // Validate node version constraint
      if (compatibility.nodeVersion && typeof compatibility.nodeVersion === 'string') {
        if (!this.semverValidator.isValidVersionRange(compatibility.nodeVersion)) {
          this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: invalid nodeVersion constraint '${compatibility.nodeVersion}'`);
          return false;
        }
      }

      // Validate host version constraints
      if (compatibility.minimumHostVersion && typeof compatibility.minimumHostVersion === 'string') {
        if (!this.semverValidator.isValidSemver(compatibility.minimumHostVersion)) {
          this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: invalid minimumHostVersion '${compatibility.minimumHostVersion}'`);
          return false;
        }
      }

      if (compatibility.maximumHostVersion && typeof compatibility.maximumHostVersion === 'string') {
        if (!this.semverValidator.isValidSemver(compatibility.maximumHostVersion)) {
          this.logger.warn(`${PLUGIN_CONSTANTS.ERRORS.INVALID_MANIFEST} for plugin in ${pluginDir}: invalid maximumHostVersion '${compatibility.maximumHostVersion}'`);
          return false;
        }
      }
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

  /**
   * Validates dependency compatibility between plugins
   * @param pluginManifests Array of plugin manifests to validate
   * @returns Validation result with compatibility matrix and errors
   */
  validateDependencyCompatibility(pluginManifests: PluginManifest[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    compatibilityMatrix: Record<
      string,
      {
        dependencies: Record<string, boolean>;
        missing: string[];
        incompatible: string[];
      }
    >;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const compatibilityMatrix: Record<
      string,
      {
        dependencies: Record<string, boolean>;
        missing: string[];
        incompatible: string[];
      }
    > = {};

    // Create a lookup map of available plugins
    const availablePlugins = new Map<string, PluginManifest>();
    for (const manifest of pluginManifests) {
      availablePlugins.set(manifest.name, manifest);
    }

    // Validate each plugin's dependencies
    for (const manifest of pluginManifests) {
      const pluginName = manifest.name;
      compatibilityMatrix[pluginName] = {
        dependencies: {},
        missing: [],
        incompatible: [],
      };

      if (!manifest.dependencies || manifest.dependencies.length === 0) {
        continue; // No dependencies to validate
      }

      for (const dependency of manifest.dependencies) {
        let depName: string;
        let versionConstraint: string | undefined;

        // Handle both string dependencies and object dependencies with version constraints
        if (typeof dependency === 'string') {
          depName = dependency;
          versionConstraint = undefined;
        } else if (typeof dependency === 'object' && dependency !== null) {
          const depObj = dependency as any;
          depName = depObj.name;
          versionConstraint = depObj.version;
        } else {
          errors.push(`Plugin '${pluginName}' has invalid dependency format: ${JSON.stringify(dependency)}`);
          continue;
        }

        // Check if dependency exists
        const dependencyPlugin = availablePlugins.get(depName);
        if (!dependencyPlugin) {
          compatibilityMatrix[pluginName].missing.push(depName);
          compatibilityMatrix[pluginName].dependencies[depName] = false;
          continue;
        }

        // If no version constraint, mark as compatible
        if (!versionConstraint) {
          compatibilityMatrix[pluginName].dependencies[depName] = true;
          continue;
        }

        // Validate version constraint
        const dependencyVersion = dependencyPlugin.version;
        const isCompatible = this.semverValidator.satisfiesRange(dependencyVersion, versionConstraint);

        compatibilityMatrix[pluginName].dependencies[depName] = isCompatible;

        if (!isCompatible) {
          compatibilityMatrix[pluginName].incompatible.push(`${depName}@${dependencyVersion} (requires ${versionConstraint})`);
          errors.push(`Plugin '${pluginName}' requires '${depName}' ${versionConstraint}, but found version ${dependencyVersion}`);
        }
      }

      // Check for missing dependencies
      if (compatibilityMatrix[pluginName].missing.length > 0) {
        errors.push(`Plugin '${pluginName}' has missing dependencies: ${compatibilityMatrix[pluginName].missing.join(', ')}`);
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(pluginManifests);
    if (circularDeps.length > 0) {
      for (const cycle of circularDeps) {
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`);
      }
    }

    // Generate warnings for potentially risky version constraints
    for (const manifest of pluginManifests) {
      if (!manifest.dependencies) continue;

      for (const dependency of manifest.dependencies) {
        if (typeof dependency === 'object' && dependency !== null) {
          const depObj = dependency as any;
          if (depObj.version) {
            // Warn about overly restrictive constraints
            if (depObj.version.includes('=') && !depObj.version.startsWith('>=') && !depObj.version.startsWith('<=')) {
              warnings.push(`Plugin '${manifest.name}' uses exact version constraint for '${depObj.name}': ${depObj.version}. Consider using range constraints for better compatibility.`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      compatibilityMatrix,
    };
  }

  /**
   * Detects circular dependencies in plugin manifests
   * @param pluginManifests Array of plugin manifests
   * @returns Array of circular dependency chains
   */
  private detectCircularDependencies(pluginManifests: PluginManifest[]): string[][] {
    const graph = new Map<string, string[]>();
    const cycles: string[][] = [];

    // Build dependency graph
    for (const manifest of pluginManifests) {
      const deps: string[] = [];
      if (manifest.dependencies) {
        for (const dependency of manifest.dependencies) {
          if (typeof dependency === 'string') {
            deps.push(dependency);
          } else if (typeof dependency === 'object' && dependency !== null) {
            const depObj = dependency as any;
            if (depObj.name) {
              deps.push(depObj.name);
            }
          }
        }
      }
      graph.set(manifest.name, deps);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        if (!graph.has(dep)) {
          continue; // Skip missing dependencies
        }

        if (recursionStack.has(dep)) {
          // Found cycle
          const cycleStart = path.indexOf(dep);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        } else if (!visited.has(dep)) {
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(node);
    };

    for (const [pluginName] of graph) {
      if (!visited.has(pluginName)) {
        dfs(pluginName, []);
      }
    }

    return cycles;
  }

  /**
   * Validates host compatibility for a plugin
   * @param manifest Plugin manifest to validate
   * @param hostVersion Current host version
   * @param nodeVersion Current Node.js version
   * @returns Validation result
   */
  validateHostCompatibility(
    manifest: PluginManifest,
    hostVersion: string,
    nodeVersion: string
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.compatibility) {
      return { valid: true, errors, warnings };
    }

    const compatibility = manifest.compatibility;

    // Validate Node.js version compatibility
    if (compatibility.nodeVersion) {
      if (!this.semverValidator.satisfiesRange(nodeVersion, compatibility.nodeVersion)) {
        errors.push(`Plugin '${manifest.name}' requires Node.js ${compatibility.nodeVersion}, but current version is ${nodeVersion}`);
      }
    }

    // Validate minimum host version
    if (compatibility.minimumHostVersion) {
      const comparison = this.semverValidator.compareVersions(hostVersion, compatibility.minimumHostVersion);
      if (comparison === null) {
        errors.push(`Plugin '${manifest.name}' has invalid minimumHostVersion: ${compatibility.minimumHostVersion}`);
      } else if (comparison < 0) {
        errors.push(`Plugin '${manifest.name}' requires minimum host version ${compatibility.minimumHostVersion}, but current version is ${hostVersion}`);
      }
    }

    // Validate maximum host version
    if (compatibility.maximumHostVersion) {
      const comparison = this.semverValidator.compareVersions(hostVersion, compatibility.maximumHostVersion);
      if (comparison === null) {
        errors.push(`Plugin '${manifest.name}' has invalid maximumHostVersion: ${compatibility.maximumHostVersion}`);
      } else if (comparison > 0) {
        errors.push(`Plugin '${manifest.name}' supports maximum host version ${compatibility.maximumHostVersion}, but current version is ${hostVersion}`);
      }
    }

    // Validate platform support
    if (compatibility.platformSupport && compatibility.platformSupport.length > 0) {
      const currentPlatform = process.platform as any;
      if (!compatibility.platformSupport.includes(currentPlatform)) {
        errors.push(`Plugin '${manifest.name}' does not support platform '${currentPlatform}'. Supported platforms: ${compatibility.platformSupport.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
