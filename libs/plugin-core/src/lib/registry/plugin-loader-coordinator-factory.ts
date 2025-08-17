import { Injectable } from '@nestjs/common';
import { PluginLoaderCoordinatorService } from './plugin-loader-coordinator.service';
import { PluginLoaderService } from '../loading/plugin-loader.service';
import { PluginDependencyResolverService } from '../security/plugin-dependency-resolver.service';

@Injectable()
export class PluginLoaderCoordinatorFactory {
  constructor(
    private readonly loaderService: PluginLoaderService,
    private readonly dependencyResolver: PluginDependencyResolverService
  ) {}

  createCoordinator(): PluginLoaderCoordinatorService {
    return new PluginLoaderCoordinatorService(
      this.loaderService,
      this.dependencyResolver
    );
  }

  createCoordinatorWithCustomServices(
    loaderService: PluginLoaderService,
    dependencyResolver: PluginDependencyResolverService
  ): PluginLoaderCoordinatorService {
    return new PluginLoaderCoordinatorService(loaderService, dependencyResolver);
  }
}