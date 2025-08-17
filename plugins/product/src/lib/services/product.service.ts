import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductService {
  getHello(): string {
    return 'Hello from Product plugin!';
  }

  // Add your plugin service methods here
}
