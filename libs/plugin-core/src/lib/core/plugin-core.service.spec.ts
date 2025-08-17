import { Test } from '@nestjs/testing';
import { PluginCore } from './plugin-core.service';

describe('PluginCore', () => {
  let service: PluginCore;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PluginCore],
    }).compile();

    service = module.get(PluginCore);
  });

  it('should be defined', () => {
    expect(service).toBeTruthy();
  });
});
