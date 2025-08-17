import { Module } from '@nestjs/common';
import { PluginCoreModule } from '@libs/plugin-core';

@Module({
  imports: [
    PluginCoreModule.forRootAsync({
      imports: [],
      useFactory: () => ({
        searchPaths: ['./plugins'],
        autoStart: true,
        enableMemoryMonitoring: true,
        defaultTimeout: 30000,
        defaultRetries: 3,
        parallelLoading: true,
        skipRuntimeLoading: false,
        securityConfig: {
          enableSandboxing: true,
          defaultPermissions: ['file:read', 'network:http'],
          trustedPlugins: ['core-plugin', 'admin-plugin'],
        },
      }),
      inject: [],
    }),
  ],
})
export class AppModule {}
