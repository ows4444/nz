import { UserController } from './user.controller';
import { UserService } from '../services/user.service';

describe('UserController', () => {
  let controller: UserController;
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    mockUserService = {
      getHello: jest.fn(),
    } as jest.Mocked<UserService>;

    controller = new UserController(mockUserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message from service', () => {
      const expectedMessage = 'Hello from User plugin!';
      mockUserService.getHello.mockReturnValue(expectedMessage);

      const result = controller.getHello();

      expect(result).toBe(expectedMessage);
      expect(mockUserService.getHello).toHaveBeenCalledTimes(1);
    });
  });
});
