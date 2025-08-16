import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  getHello(): string {
    return 'Hello from Auth plugin!';
  }

  // Add your plugin service methods here
}
