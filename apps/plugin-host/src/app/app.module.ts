import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PluginCoreModule, PLUGIN_CONSTANTS } from '@libs/plugin-core';
import { DynamicDtoModule } from '@libs/dynamic-dto';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    DynamicDtoModule.forRoot({
      isGlobal: true,
      imports: [],
      cache: {
        ttl: 60000,
      },
      validation: {
        enableCrossFieldValidation: true,
        maxNestingDepth: 5,
        performanceMode: 'optimized',
      },
    }),
    PluginCoreModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService?: ConfigService) => ({
        autoStart: configService?.get<boolean>('PLUGIN_AUTO_START', true),
        enableMemoryMonitoring: true,
        defaultTimeout: PLUGIN_CONSTANTS.DEFAULT_TIMEOUT,
        defaultRetries: PLUGIN_CONSTANTS.DEFAULT_RETRIES,
        parallelLoading: true,
        skipRuntimeLoading: false,
        securityConfig: {
          enableSandboxing: true,
          defaultPermissions: [PLUGIN_CONSTANTS.DEFAULT_PERMISSIONS.FILE_READ, PLUGIN_CONSTANTS.DEFAULT_PERMISSIONS.NETWORK_HTTP],
          trustedPlugins: ['core-plugin', 'admin-plugin'],
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
