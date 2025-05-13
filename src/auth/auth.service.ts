import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon from 'argon2';
import { AuthDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { UserFindOneLocalResponse } from '../user/dto';
import { TokenService } from '../token/token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
  ) {}

  async register(registerDto: AuthDto) {
    const { email, password } = registerDto;

    // 1. Проверяем, существует ли пользователь
    try {
      // Пытаемся найти пользователя. Если найден, то UserService НЕ выбросит ошибку.
      await this.userService.localFindOne({ email });
      // Если мы здесь, то пользователь найден
      throw new ConflictException(`User with email ${email} already exists`);
    } catch (e) {
      // Если мы здесь, значит findOne выбросил ошибку
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
      // Если мы здесь, то мы поймали NotFound, продолжаем
    }

    const hashedPassword = await argon.hash(password);

    try {
      const newUser = await this.prismaService.user.create({
        data: {
          email: email,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
        },
      });

      const tokens = await this.tokenService.generateTokens(newUser);
      await this.tokenService.saveRefreshToken(newUser.id, tokens.refreshToken);
      return tokens;
    } catch (e) {
      console.error('Error creating user:', e);
      throw new InternalServerErrorException('Could not register user.');
    }
  }

  async login(loginDto: AuthDto) {
    const { email, password } = loginDto;
    let user: UserFindOneLocalResponse;

    try {
      user = await this.userService.localFindOne({ email });
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
    }

    if (!(await this.comparePassword(user.password, password))) {
      throw new UnauthorizedException('Invalid Email or password');
    }

    const { id } = user;

    const tokens = await this.tokenService.generateTokens({
      id,
      email,
    });

    await this.tokenService.saveRefreshToken(id, tokens.refreshToken);

    return tokens;
  }

  private async comparePassword(
    hashedPassword: string,
    password: string,
  ): Promise<boolean> {
    return argon.verify(hashedPassword, password);
  }
}
