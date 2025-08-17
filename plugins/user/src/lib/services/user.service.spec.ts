import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return correct hello message', () => {
      const result = service.getHello();

      expect(result).toBe('Hello from User plugin!');
      expect(typeof result).toBe('string');
    });

    it('should return consistent message on multiple calls', () => {
      const firstCall = service.getHello();
      const secondCall = service.getHello();

      expect(firstCall).toBe(secondCall);
    });
  });
});
