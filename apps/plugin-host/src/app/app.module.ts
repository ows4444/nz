import { Module } from '@nestjs/common';
import { PluginCoreModule } from '@libs/plugin-core';

@Module({
  imports: [
    PluginCoreModule.forRoot({
      searchPaths: ['./plugins'],
      autoStart: true,
      enableMemoryMonitoring: true,
      defaultTimeout: 30000,
      defaultRetries: 3,
      parallelLoading: true,
      securityConfig: {
        enableSandboxing: true,
        defaultPermissions: ['file:read', 'network:http'],
        trustedPlugins: ['core-plugin', 'admin-plugin'],
      },
    }),
  ],
})
export class AppModule {}
