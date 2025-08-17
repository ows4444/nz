import { Injectable, Logger } from '@nestjs/common';
import { PluginManifest } from '../types/plugin-strict-interfaces';

@Injectable()
export class PluginDependencyResolverService {
  private readonly logger = new Logger(PluginDependencyResolverService.name);

  async resolveDependencies(manifests: PluginManifest[]): Promise<PluginManifest[]> {
    this.logger.log(`Resolving dependencies for ${manifests.length} plugins`);

    const manifestMap = new Map(manifests.map(m => [m.id, m]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const resolved: PluginManifest[] = [];

    for (const manifest of manifests) {
      if (!visited.has(manifest.id)) {
        await this.visitPlugin(manifest.id, manifestMap, visited, visiting, resolved);
      }
    }

    this.logger.log(`Resolved dependency order: ${resolved.map(m => m.id).join(' -> ')}`);
    return resolved;
  }

  validateDependencies(manifests: PluginManifest[]): DependencyValidationResult {
    const result: DependencyValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    const manifestMap = new Map(manifests.map(m => [m.id, m]));

    for (const manifest of manifests) {
      this.validatePluginDependencies(manifest, manifestMap, result);
    }

    if (result.errors.length > 0) {
      result.valid = false;
    }

    return result;
  }

  findCircularDependencies(manifests: PluginManifest[]): CircularDependency[] {
    const manifestMap = new Map(manifests.map(m => [m.id, m]));
    const circularDeps: CircularDependency[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    for (const manifest of manifests) {
      if (!visited.has(manifest.id)) {
        const path: string[] = [];
        this.findCircularDependenciesForPlugin(
          manifest.id,
          manifestMap,
          visited,
          visiting,
          path,
          circularDeps
        );
      }
    }

    return circularDeps;
  }

  getDependencyGraph(manifests: PluginManifest[]): DependencyGraph {
    const nodes = manifests.map(m => ({
      id: m.id,
      name: m.name,
      version: m.version
    }));

    const edges: DependencyEdge[] = [];
    
    for (const manifest of manifests) {
      const dependencies = manifest.dependencies || [];
      for (const depId of dependencies) {
        edges.push({
          from: manifest.id,
          to: depId,
          type: 'dependency'
        });
      }
    }

    return { nodes, edges };
  }

  private async visitPlugin(
    pluginId: string,
    manifestMap: Map<string, PluginManifest>,
    visited: Set<string>,
    visiting: Set<string>,
    resolved: PluginManifest[]
  ): Promise<void> {
    if (visiting.has(pluginId)) {
      throw new Error(`Circular dependency detected involving plugin: ${pluginId}`);
    }

    if (visited.has(pluginId)) {
      return;
    }

    const manifest = manifestMap.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    visiting.add(pluginId);

    const dependencies = manifest.dependencies || [];
    for (const depId of dependencies) {
      await this.visitPlugin(depId, manifestMap, visited, visiting, resolved);
    }

    visiting.delete(pluginId);
    visited.add(pluginId);
    resolved.push(manifest);
  }

  private validatePluginDependencies(
    manifest: PluginManifest,
    manifestMap: Map<string, PluginManifest>,
    result: DependencyValidationResult
  ): void {
    const dependencies = manifest.dependencies || [];

    for (const depId of dependencies) {
      const depManifest = manifestMap.get(depId);
      
      if (!depManifest) {
        result.errors.push(`Plugin ${manifest.id} has missing dependency: ${depId}`);
        continue;
      }

      // Check version compatibility if version ranges are specified
      if (this.hasVersionConflict(manifest, depManifest)) {
        result.warnings.push(
          `Plugin ${manifest.id} may have version conflict with dependency ${depId}`
        );
      }
    }
  }

  private findCircularDependenciesForPlugin(
    pluginId: string,
    manifestMap: Map<string, PluginManifest>,
    visited: Set<string>,
    visiting: Set<string>,
    path: string[],
    circularDeps: CircularDependency[]
  ): void {
    if (visiting.has(pluginId)) {
      const circularStart = path.indexOf(pluginId);
      const cycle = [...path.slice(circularStart), pluginId];
      circularDeps.push({ cycle });
      return;
    }

    if (visited.has(pluginId)) {
      return;
    }

    const manifest = manifestMap.get(pluginId);
    if (!manifest) {
      return;
    }

    visiting.add(pluginId);
    path.push(pluginId);

    const dependencies = manifest.dependencies || [];
    for (const depId of dependencies) {
      this.findCircularDependenciesForPlugin(
        depId,
        manifestMap,
        visited,
        visiting,
        path,
        circularDeps
      );
    }

    path.pop();
    visiting.delete(pluginId);
    visited.add(pluginId);
  }

  private hasVersionConflict(_manifest: PluginManifest, _depManifest: PluginManifest): boolean {
    // This is a simplified version conflict check
    // In a real implementation, you would use semver for proper version range checking
    return false;
  }
}

export interface DependencyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CircularDependency {
  cycle: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  name: string;
  version: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'dependency' | 'optional';
}