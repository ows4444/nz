import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockAuthService = {
      getHello: jest.fn(),
    } as jest.Mocked<AuthService>;

    controller = new AuthController(mockAuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message from service', () => {
      const expectedMessage = 'Hello from Auth plugin!';
      mockAuthService.getHello.mockReturnValue(expectedMessage);

      const result = controller.getHello();

      expect(result).toBe(expectedMessage);
      expect(mockAuthService.getHello).toHaveBeenCalledTimes(1);
    });
  });
});
