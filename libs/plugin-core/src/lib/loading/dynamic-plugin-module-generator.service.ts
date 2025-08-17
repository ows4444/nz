import {
  Injectable,
  Logger,
  Module,
  Type,
} from '@nestjs/common';
import { PluginManifest } from '../types/plugin-strict-interfaces';
import * as path from 'path';
import * as fs from 'fs';

export interface PluginModuleDefinition {
  controllers?: string[];
  providers?: string[];
  exports?: string[];
  imports?: string[];
  guards?: string[];
  interceptors?: string[];
  pipes?: string[];
  crossPluginServices?: string[];
}

export interface GeneratedPluginModule {
  moduleClass: Type<unknown>;
  metadata: {
    controllers: Type<unknown>[];
    providers: Type<unknown>[];
    exports: Type<unknown>[];
    imports: Type<unknown>[];
  };
}

@Injectable()
export class DynamicPluginModuleGeneratorService {
  private readonly logger = new Logger(
    DynamicPluginModuleGeneratorService.name
  );

  async generatePluginModule(
    manifest: PluginManifest
  ): Promise<GeneratedPluginModule> {
    try {
      this.logger.log(
        `Generating dynamic module for plugin: ${manifest.id}`
      );

      // Extract paths correctly - entryPoint is: /path/to/plugin/dist/index.js
      const pluginDistDir = path.dirname(manifest.entryPoint); // /path/to/plugin/dist
      const pluginRootDir = path.dirname(pluginDistDir); // /path/to/plugin

      this.logger.log(
        `Plugin root dir: ${pluginRootDir}, dist dir: ${pluginDistDir}`
      );

      const manifestContent = await this.loadManifestContent(pluginRootDir);
      const moduleDefinition = manifestContent.module as PluginModuleDefinition;

      if (!moduleDefinition) {
        throw new Error(
          `No module definition found in manifest for plugin: ${manifest.id}`
        );
      }

      const moduleMetadata = await this.buildModuleMetadata(
        pluginDistDir,
        moduleDefinition
      );
      const dynamicModuleClass = this.createDynamicModuleClass(
        String(manifest.id)
          .replace('@plugins/', '')
          .replace(/^[a-z]/, (c) => c.toUpperCase()) 
          .replace(/-/g, ''), 

        moduleMetadata
      );

      return {
        moduleClass: dynamicModuleClass,
        metadata: moduleMetadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate dynamic module for plugin: ${manifest.id}`,
        error
      );
      throw error;
    }
  }

  private async loadManifestContent(pluginRootDir: string): Promise<any> {
    const manifestPath = path.join(pluginRootDir, 'plugin.manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found at: ${manifestPath}`);
    }

    try {
      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return manifestContent;
    } catch (error) {
      throw new Error(`Failed to parse plugin manifest: ${error}`);
    }
  }

  private async buildModuleMetadata(
    pluginDistDir: string,
    moduleDefinition: PluginModuleDefinition
  ): Promise<{
    controllers: Type<any>[];
    providers: Type<any>[];
    exports: Type<any>[];
    imports: Type<any>[];
  }> {
    const controllers = await this.loadControllers(
      pluginDistDir,
      moduleDefinition.controllers || []
    );
    const providers = await this.loadProviders(
      pluginDistDir,
      moduleDefinition.providers || []
    );
    const exports = await this.loadExports(
      pluginDistDir,
      moduleDefinition.exports || []
    );
    const imports = await this.loadImports(
      pluginDistDir,
      moduleDefinition.imports || []
    );

    return {
      controllers,
      providers,
      exports,
      imports,
    };
  }

  private async loadControllers(
    pluginDistDir: string,
    controllerNames: string[]
  ): Promise<Type<any>[]> {
    const controllers: Type<any>[] = [];

    for (const controllerName of controllerNames) {
      try {
        const controllerPath = this.resolveControllerPath(
          pluginDistDir,
          controllerName
        );
        const controllerModule = await this.loadModule(controllerPath);

        if (controllerModule[controllerName]) {
          controllers.push(controllerModule[controllerName]);
          this.logger.log(`Loaded controller: ${controllerName}`);
        } else {
          this.logger.warn(
            `Controller ${controllerName} not found in module at ${controllerPath}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to load controller ${controllerName}:`,
          error
        );
        throw error;
      }
    }

    return controllers;
  }

  private async loadProviders(
    pluginDistDir: string,
    providerNames: string[]
  ): Promise<Type<any>[]> {
    const providers: Type<any>[] = [];

    for (const providerName of providerNames) {
      try {
        const providerPath = this.resolveProviderPath(
          pluginDistDir,
          providerName
        );
        const providerModule = await this.loadModule(providerPath);

        if (providerModule[providerName]) {
          providers.push(providerModule[providerName]);
          this.logger.log(`Loaded provider: ${providerName}`);
        } else {
          this.logger.warn(
            `Provider ${providerName} not found in module at ${providerPath}`
          );
        }
      } catch (error) {
        this.logger.error(`Failed to load provider ${providerName}:`, error);
        throw error;
      }
    }

    return providers;
  }

  private async loadExports(
    pluginDistDir: string,
    exportNames: string[]
  ): Promise<Type<any>[]> {
    const exports: Type<any>[] = [];

    for (const exportName of exportNames) {
      try {
        const exportPath = this.resolveProviderPath(pluginDistDir, exportName);
        const exportModule = await this.loadModule(exportPath);

        if (exportModule[exportName]) {
          exports.push(exportModule[exportName]);
          this.logger.log(`Loaded export: ${exportName}`);
        } else {
          this.logger.warn(
            `Export ${exportName} not found in module at ${exportPath}`
          );
        }
      } catch (error) {
        this.logger.error(`Failed to load export ${exportName}:`, error);
        throw error;
      }
    }

    return exports;
  }

  private async loadImports(
    _pluginDir: string,
    importNames: string[]
  ): Promise<Type<any>[]> {
    const imports: Type<any>[] = [];

    for (const importName of importNames) {
      try {
        this.logger.log(`Processing import: ${importName}`);
        imports.push(importName as any);
      } catch (error) {
        this.logger.error(`Failed to process import ${importName}:`, error);
        throw error;
      }
    }

    return imports;
  }

  private resolveControllerPath(
    pluginDistDir: string,
    controllerName: string
  ): string {
    const baseName = controllerName.toLowerCase().replace('controller', '');
    return path.join(
      pluginDistDir,
      'lib',
      'controllers',
      `${baseName}.controller.js`
    );
  }

  private resolveProviderPath(
    pluginDistDir: string,
    providerName: string
  ): string {
    const baseName = providerName.toLowerCase().replace('service', '');
    return path.join(
      pluginDistDir,
      'lib',
      'services',
      `${baseName}.service.js`
    );
  }

  private async loadModule(modulePath: string): Promise<any> {
    const resolvedPath = path.resolve(modulePath);

    this.logger.log(`Attempting to load module at: ${resolvedPath}`);
    this.logger.log(`File exists: ${fs.existsSync(resolvedPath)}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Module file not found at: ${resolvedPath}`);
    }

    try {
      // Clear require cache
      delete require.cache[resolvedPath];

      // Use eval to bypass webpack's static analysis
      const nodeRequire = eval('require');
      const module = nodeRequire(resolvedPath);

      this.logger.log(
        `Successfully loaded module, exports: ${Object.keys(module)}`
      );
      return module;
    } catch (error) {
      this.logger.error(`Module load error details:`, error);
      throw new Error(`Failed to require module at ${resolvedPath}: ${error}`);
    }
  }

  private createDynamicModuleClass(
    pluginId: string,
    metadata: {
      controllers: Type<any>[];
      providers: Type<any>[];
      exports: Type<any>[];
      imports: Type<any>[];
    }
  ): Type<any> {
    @Module({
      imports: metadata.imports,
      controllers: metadata.controllers,
      providers: metadata.providers,
      exports: metadata.exports,
    })
    class GeneratedPluginModule {}

    Object.defineProperty(GeneratedPluginModule, 'name', {
      value: `${pluginId}Module`,
      configurable: true,
    });

    this.logger.log(
      `Created dynamic module ${pluginId}Module with ${metadata.controllers.length} controllers, ` +
        `${metadata.providers.length} providers, and ${metadata.exports.length} exports`
    );

    return GeneratedPluginModule;
  }
}
