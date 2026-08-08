import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User } from '../users/entities/user.entity';

export interface AuthResponse {
  accessToken: string;
  user: Omit<User, 'password' | 'hashPassword' | 'comparePassword'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    const user = await this.usersService.create(createUserDto);
    return this.generateResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await user.comparePassword(loginDto.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.generateResponse(user);
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.usersService.findOne(userId).catch(() => null);
  }

  private generateResponse(user: User): AuthResponse {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    const safeUser = { ...user } as Record<string, unknown>;
    Reflect.deleteProperty(safeUser, 'password');

    return {
      accessToken: this.jwtService.sign(payload),
      user: safeUser as AuthResponse['user'],
    };
  }
}
