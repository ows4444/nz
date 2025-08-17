import { ProductController } from './product.controller';
import { ProductService } from '../services/product.service';

describe('ProductController', () => {
  let controller: ProductController;
  let mockProductService: jest.Mocked<ProductService>;

  beforeEach(() => {
    mockProductService = {
      getHello: jest.fn(),
    } as jest.Mocked<ProductService>;

    controller = new ProductController(mockProductService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return hello message from service', () => {
      const expectedMessage = 'Hello from Product plugin!';
      mockProductService.getHello.mockReturnValue(expectedMessage);

      const result = controller.getHello();

      expect(result).toBe(expectedMessage);
      expect(mockProductService.getHello).toHaveBeenCalledTimes(1);
    });
  });
});
