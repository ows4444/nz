import { Module } from '@nestjs/common';

// Cache infrastructure
import { CacheManagerService } from '../infrastructure/cache/cache-manager.service';
import { MemoryCacheStrategy } from '../infrastructure/cache/strategies/memory-cache.strategy';

@Module({
  providers: [
    // Cache strategy interface implementation
    {
      provide: 'ICacheStrategy',
      useClass: MemoryCacheStrategy,
    },

    // Cache manager service
    CacheManagerService,

    // Cache manager interface implementation
    {
      provide: 'ICacheManager',
      useClass: CacheManagerService,
    },
  ],
  exports: ['ICacheStrategy', 'ICacheManager', CacheManagerService],
})
export class CacheModule {}
