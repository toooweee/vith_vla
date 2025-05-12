import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as argon from 'argon2';
import { AuthDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
  ) {}

  async register(registerDto: AuthDto) {
    const { email, password } = registerDto;

    // 1. Проверяем, существует ли пользователь
    try {
      // Пытаемся найти пользователя. Если найден, то UserService НЕ выбросит ошибку.
      await this.userService.findOne({ email });
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
      });
      return newUser;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('User with email ${email} already exists');
      }
      console.error('Error creating user:', e);
      throw new InternalServerErrorException('Could not register user.');
    }
  }

  async login() {}
}
