import { Injectable, Logger } from '@nestjs/common';
import { PluginSecurityContext, PluginManifest, ResourceLimits } from '../types/plugin-strict-interfaces';

@Injectable()
export class PluginSecurityManagerService {
  private readonly logger = new Logger(PluginSecurityManagerService.name);
  private readonly pluginSecurityContexts = new Map<string, PluginSecurityContext>();

  createSecurityContext(manifest: PluginManifest): PluginSecurityContext {
    const context: PluginSecurityContext = {
      permissions: this.parsePermissions(manifest),
      sandboxed: this.shouldSandbox(manifest),
      resourceLimits: this.createResourceLimits(manifest)
    };

    this.pluginSecurityContexts.set(manifest.id, context);
    this.logger.log(`Created security context for plugin ${manifest.id}`);

    return context;
  }

  validatePermission(pluginId: string, permission: string): boolean {
    const context = this.pluginSecurityContexts.get(pluginId);
    if (!context) {
      this.logger.warn(`No security context found for plugin ${pluginId}`);
      return false;
    }

    const hasPermission = context.permissions.includes(permission) || context.permissions.includes('*');
    
    if (!hasPermission) {
      this.logger.warn(`Plugin ${pluginId} denied permission: ${permission}`);
    }

    return hasPermission;
  }

  enforceResourceLimits(pluginId: string, resourceUsage: ResourceUsage): boolean {
    const context = this.pluginSecurityContexts.get(pluginId);
    if (!context) {
      return true; // No limits defined
    }

    const limits = context.resourceLimits;

    if (limits.maxMemory && resourceUsage.memory > limits.maxMemory) {
      this.logger.error(`Plugin ${pluginId} exceeded memory limit: ${resourceUsage.memory} > ${limits.maxMemory}`);
      return false;
    }

    if (limits.maxCpuTime && resourceUsage.cpuTime > limits.maxCpuTime) {
      this.logger.error(`Plugin ${pluginId} exceeded CPU time limit: ${resourceUsage.cpuTime} > ${limits.maxCpuTime}`);
      return false;
    }

    if (limits.maxFileDescriptors && resourceUsage.fileDescriptors > limits.maxFileDescriptors) {
      this.logger.error(`Plugin ${pluginId} exceeded file descriptor limit: ${resourceUsage.fileDescriptors} > ${limits.maxFileDescriptors}`);
      return false;
    }

    return true;
  }

  createSandbox(pluginId: string): PluginSandbox {
    const context = this.pluginSecurityContexts.get(pluginId);
    if (!context || !context.sandboxed) {
      return new NoOpSandbox();
    }

    return new SecureSandbox(pluginId, context);
  }

  auditPluginAccess(pluginId: string, action: string, resource: string): void {
    this.logger.log(`Plugin ${pluginId} accessed ${resource} with action: ${action}`);
    // In a real implementation, this would log to an audit system
  }

  revokeAccess(pluginId: string): void {
    this.pluginSecurityContexts.delete(pluginId);
    this.logger.log(`Revoked security access for plugin ${pluginId}`);
  }

  private parsePermissions(manifest: PluginManifest): string[] {
    const permissions: string[] = [];
    
    // Extract permissions from the permissions object
    if (manifest.permissions) {
      if (manifest.permissions.services) permissions.push(...manifest.permissions.services);
      if (manifest.permissions.modules) permissions.push(...manifest.permissions.modules);
      if (manifest.permissions.fileSystem) permissions.push(...manifest.permissions.fileSystem);
      if (manifest.permissions.network) permissions.push(...manifest.permissions.network);
      if (manifest.permissions.system) permissions.push(...manifest.permissions.system);
    }
    
    // Validate permissions against allowed list
    const allowedPermissions = [
      'file:read',
      'file:write',
      'network:http',
      'network:https',
      'system:execute',
      'storage:read',
      'storage:write'
    ];

    return permissions.filter((permission: string) => 
      allowedPermissions.includes(permission) || permission === '*'
    );
  }

  private shouldSandbox(manifest: PluginManifest): boolean {
    // Sandbox by default, unless explicitly trusted
    return !manifest.metadata?.trusted;
  }

  private createResourceLimits(manifest: PluginManifest): ResourceLimits {
    const defaultLimits: ResourceLimits = {
      maxMemory: 100 * 1024 * 1024, // 100MB
      maxCpuTime: 5000, // 5 seconds
      maxFileDescriptors: 50
    };

    const customLimits = manifest.metadata?.resourceLimits || {};
    return { ...defaultLimits, ...(typeof customLimits === 'object' ? customLimits : {}) };
  }
}

export interface ResourceUsage {
  memory: number;
  cpuTime: number;
  fileDescriptors: number;
}

export abstract class PluginSandbox {
  abstract execute<T>(operation: () => T): Promise<T>;
  abstract destroy(): Promise<void>;
}

class NoOpSandbox extends PluginSandbox {
  async execute<T>(operation: () => T): Promise<T> {
    return operation();
  }

  async destroy(): Promise<void> {
    // No-op
  }
}

class SecureSandbox extends PluginSandbox {
  constructor(
    _pluginId: string, // Plugin ID for future use
    private readonly context: PluginSecurityContext
  ) {
    super();
  }

  async execute<T>(operation: () => T): Promise<T> {
    // In a real implementation, this would set up a secure execution context
    // For now, just execute with basic monitoring
    const startTime = Date.now();
    
    const result = operation();
    const executionTime = Date.now() - startTime;
    
    if (this.context.resourceLimits.maxCpuTime && executionTime > this.context.resourceLimits.maxCpuTime) {
      throw new Error(`Operation exceeded CPU time limit: ${executionTime}ms`);
    }
    
    return result;
  }

  async destroy(): Promise<void> {
    // Clean up sandbox resources
  }
}