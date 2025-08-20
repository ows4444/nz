import { Injectable, Logger } from '@nestjs/common';
import { PluginManifest, PluginDependencyFilterResult, EnhancedDependencyFilterResult, DependencyDeclaration } from '../types';

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
   * Extracts dependency name from a dependency declaration
   * @param dependency Dependency declaration (string or object)
   * @returns Dependency name
   */
  private getDependencyName(dependency: DependencyDeclaration): string {
    if (typeof dependency === 'string') {
      return dependency;
    }
    return dependency.name;
  }

  /**
   * Extracts dependency names from an array of dependency declarations
   * @param dependencies Array of dependency declarations
   * @returns Array of dependency names
   */
  private getDependencyNames(dependencies: DependencyDeclaration[]): string[] {
    return dependencies.map(dep => this.getDependencyName(dep));
  }

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
      const dependencyNames = plugin.manifest.dependencies ? this.getDependencyNames(plugin.manifest.dependencies) : [];
      graph[plugin.manifest.name] = {
        manifest: plugin.manifest,
        dependencies: dependencyNames,
        dependents: [],
      };
    }

    // Build dependency relationships
    for (const plugin of pluginData) {
      const dependencies = plugin.manifest.dependencies || [];
      for (const dependency of dependencies) {
        const depName = this.getDependencyName(dependency);
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
      for (const dependency of dependencies) {
        const depName = this.getDependencyName(dependency);
        if (!availablePlugins.has(depName)) {
          errors.push(`Plugin "${plugin.manifest.name}" depends on "${depName}" which is not available`);
        }
      }
    }

    return errors;
  }

  /**
   * Filters out plugins with missing dependencies and returns loadable plugins
   * @param pluginData Array of plugin data
   * @returns Object containing loadable plugins and dependency errors
   */
  filterLoadablePlugins(pluginData: ResolvedPlugin[]): PluginDependencyFilterResult & { loadablePlugins: ResolvedPlugin[] } {
    const errors: string[] = [];
    const excludedPlugins: string[] = [];
    const availablePlugins = new Set(pluginData.map((p) => p.manifest.name));
    const pluginsWithMissingDeps = new Set<string>();

    // First pass: identify plugins with missing dependencies
    for (const plugin of pluginData) {
      const dependencies = plugin.manifest.dependencies || [];
      for (const dependency of dependencies) {
        const depName = this.getDependencyName(dependency);
        if (!availablePlugins.has(depName)) {
          errors.push(`Plugin "${plugin.manifest.name}" depends on "${depName}" which is not available`);
          pluginsWithMissingDeps.add(plugin.manifest.name);
        }
      }
    }

    // Second pass: recursively exclude plugins that depend on excluded plugins
    let hasChanges = true;
    while (hasChanges) {
      hasChanges = false;
      for (const plugin of pluginData) {
        if (pluginsWithMissingDeps.has(plugin.manifest.name)) {
          continue; // Already excluded
        }

        const dependencies = plugin.manifest.dependencies || [];
        for (const dependency of dependencies) {
          const depName = this.getDependencyName(dependency);
          if (pluginsWithMissingDeps.has(depName)) {
            errors.push(`Plugin "${plugin.manifest.name}" excluded because dependency "${depName}" is not loadable`);
            pluginsWithMissingDeps.add(plugin.manifest.name);
            hasChanges = true;
            break;
          }
        }
      }
    }

    // Filter out plugins with missing dependencies
    const loadablePlugins = pluginData.filter((plugin) => !pluginsWithMissingDeps.has(plugin.manifest.name));
    
    excludedPlugins.push(...pluginsWithMissingDeps);

    return {
      loadablePlugins,
      dependencyErrors: errors,
      excludedPlugins,
    };
  }

  /**
   * Enhanced version with detailed error reporting and structured data
   * @param pluginData Array of plugin data
   * @returns Enhanced result with structured error information
   */
  filterLoadablePluginsWithDetails(pluginData: ResolvedPlugin[]): EnhancedDependencyFilterResult & { loadablePlugins: ResolvedPlugin[] } {
    const basicResult = this.filterLoadablePlugins(pluginData);
    const structuredErrors: Array<{
      pluginName: string;
      missingDependencies: string[];
      errorType: 'missing' | 'circular';
      affectedPlugins: string[];
    }> = [];

    const availablePlugins = new Set(pluginData.map((p) => p.manifest.name));
    const dependencyMap = new Map<string, string[]>();

    // Build dependency mapping and identify missing dependencies
    for (const plugin of pluginData) {
      const dependencies = plugin.manifest.dependencies || [];
      const dependencyNames = this.getDependencyNames(dependencies);
      dependencyMap.set(plugin.manifest.name, dependencyNames);

      const missingDeps = dependencyNames.filter((dep) => !availablePlugins.has(dep));
      if (missingDeps.length > 0) {
        // Find all plugins affected by this missing dependency
        const affectedPlugins = this.findAffectedPlugins(plugin.manifest.name, dependencyMap);
        
        structuredErrors.push({
          pluginName: plugin.manifest.name,
          missingDependencies: missingDeps,
          errorType: 'missing',
          affectedPlugins,
        });
      }
    }

    // Generate summary
    const summary = {
      totalPlugins: pluginData.length,
      loadablePlugins: basicResult.loadablePlugins.length,
      excludedPlugins: basicResult.excludedPlugins.length,
      criticalErrors: structuredErrors.filter((error) => error.errorType === 'missing').length,
    };

    return {
      ...basicResult,
      structuredErrors,
      summary,
    };
  }

  /**
   * Find all plugins that would be affected if a given plugin is excluded
   * @param pluginName Name of the plugin to check
   * @param dependencyMap Map of plugin dependencies
   * @returns Array of plugin names that depend on this plugin
   */
  private findAffectedPlugins(pluginName: string, dependencyMap: Map<string, string[]>): string[] {
    const affected: string[] = [];
    const visited = new Set<string>();

    const findDependents = (currentPlugin: string): void => {
      if (visited.has(currentPlugin)) return;
      visited.add(currentPlugin);

      for (const [name, deps] of dependencyMap.entries()) {
        if (deps.includes(currentPlugin) && !affected.includes(name)) {
          affected.push(name);
          findDependents(name); // Recursively find dependents
        }
      }
    };

    findDependents(pluginName);
    return affected;
  }
}
