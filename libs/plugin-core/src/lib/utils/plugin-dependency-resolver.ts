import { Injectable, Logger } from '@nestjs/common';
import { PluginManifest } from '../types';

export interface DependencyGraph {
  [pluginName: string]: {
    manifest: PluginManifest;
    dependencies: string[];
    dependents: string[];
  };
}

export interface ResolvedPlugin {
  manifest: PluginManifest;
  resolvedPath: string;
  pluginDir: string;
}

@Injectable()
export class PluginDependencyResolver {
  private readonly logger = new Logger(PluginDependencyResolver.name);

  /**
   * Resolves plugin loading order using topological sort based on dependencies
   * @param pluginData Array of plugin manifests with their paths
   * @returns Array of plugins sorted in dependency order (dependencies first)
   * @throws Error if circular dependencies are detected
   */
  resolveLoadingOrder(pluginData: ResolvedPlugin[]): ResolvedPlugin[] {
    if (pluginData.length === 0) {
      return [];
    }

    // Build dependency graph
    const graph = this.buildDependencyGraph(pluginData);

    // Detect circular dependencies
    this.detectCircularDependencies(graph);

    // Perform topological sort
    const sortedPluginNames = this.topologicalSort(graph);

    // Return plugins in resolved order
    return sortedPluginNames.map((name) => pluginData.find((p) => p.manifest.name === name)).filter((plugin): plugin is ResolvedPlugin => plugin !== undefined);
  }

  /**
   * Builds a dependency graph from plugin manifests
   */
  private buildDependencyGraph(pluginData: ResolvedPlugin[]): DependencyGraph {
    const graph: DependencyGraph = {};

    // Initialize graph nodes
    for (const plugin of pluginData) {
      graph[plugin.manifest.name] = {
        manifest: plugin.manifest,
        dependencies: plugin.manifest.dependencies || [],
        dependents: [],
      };
    }

    // Build dependency relationships
    for (const plugin of pluginData) {
      const dependencies = plugin.manifest.dependencies || [];
      for (const depName of dependencies) {
        if (graph[depName]) {
          graph[depName].dependents.push(plugin.manifest.name);
        } else {
          this.logger.warn(`Plugin "${plugin.manifest.name}" depends on "${depName}" which is not available`);
        }
      }
    }

    return graph;
  }

  /**
   * Detects circular dependencies in the plugin graph
   * @param graph The dependency graph
   * @throws Error if circular dependencies are found
   */
  private detectCircularDependencies(graph: DependencyGraph): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const pluginName of Object.keys(graph)) {
      if (!visited.has(pluginName)) {
        const cycle = this.findCycleDFS(graph, pluginName, visited, recursionStack, []);
        if (cycle) {
          throw new Error(`Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`);
        }
      }
    }
  }

  /**
   * DFS helper for circular dependency detection
   * @param graph The dependency graph
   * @param node Current node being visited
   * @param visited Set of visited nodes
   * @param recursionStack Set of nodes in current recursion stack
   * @param path Current path being traversed
   * @returns Cycle path if found, null otherwise
   */
  private findCycleDFS(graph: DependencyGraph, node: string, visited: Set<string>, recursionStack: Set<string>, path: string[]): string[] | null {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const dependency of graph[node].dependencies) {
      if (!graph[dependency]) {
        continue; // Skip missing dependencies
      }

      if (recursionStack.has(dependency)) {
        // Found cycle - return path from cycle start
        const cycleStartIndex = path.indexOf(dependency);
        return path.slice(cycleStartIndex);
      }

      if (!visited.has(dependency)) {
        const cycle = this.findCycleDFS(graph, dependency, visited, recursionStack, path);
        if (cycle) {
          return cycle;
        }
      }
    }

    recursionStack.delete(node);
    path.pop();
    return null;
  }

  /**
   * Performs topological sort using Kahn's algorithm
   * @param graph The dependency graph
   * @returns Array of plugin names in topological order
   */
  private topologicalSort(graph: DependencyGraph): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];

    // Calculate in-degrees (number of dependencies)
    for (const pluginName of Object.keys(graph)) {
      inDegree.set(pluginName, graph[pluginName].dependencies.length);

      if (graph[pluginName].dependencies.length === 0) {
        queue.push(pluginName);
      }
    }

    // Process nodes with no dependencies first
    while (queue.length > 0) {
      // Sort queue to ensure deterministic ordering when multiple plugins have same priority
      queue.sort((a, b) => {
        const orderA = graph[a].manifest.loadOrder || 0;
        const orderB = graph[b].manifest.loadOrder || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.localeCompare(b); // Fallback to alphabetical
      });

      const current = queue.shift()!;
      result.push(current);

      // Reduce in-degree for all dependents
      for (const dependent of graph[current].dependents) {
        const currentInDegree = inDegree.get(dependent)!;
        inDegree.set(dependent, currentInDegree - 1);

        if (currentInDegree - 1 === 0) {
          queue.push(dependent);
        }
      }
    }

    // Verify all nodes were processed (no cycles)
    if (result.length !== Object.keys(graph).length) {
      const remaining = Object.keys(graph).filter((name) => !result.includes(name));
      throw new Error(`Failed to resolve dependencies. Remaining plugins: ${remaining.join(', ')}`);
    }

    return result;
  }

  /**
   * Validates that all dependencies are satisfied
   * @param pluginData Array of plugin data
   * @returns Array of validation errors
   */
  validateDependencies(pluginData: ResolvedPlugin[]): string[] {
    const errors: string[] = [];
    const availablePlugins = new Set(pluginData.map((p) => p.manifest.name));

    for (const plugin of pluginData) {
      const dependencies = plugin.manifest.dependencies || [];
      for (const depName of dependencies) {
        if (!availablePlugins.has(depName)) {
          errors.push(`Plugin "${plugin.manifest.name}" depends on "${depName}" which is not available`);
        }
      }
    }

    return errors;
  }
}
