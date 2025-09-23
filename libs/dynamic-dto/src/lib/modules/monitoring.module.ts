import { Module } from '@nestjs/common';

@Module({
  providers: [
    // Cache monitor configuration provider
    {
      provide: 'CACHE_MONITOR_CONFIG',
      useValue: {},
    },
  ],
  exports: ['CACHE_MONITOR_CONFIG'],
})
export class MonitoringModule {}
