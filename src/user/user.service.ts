import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '../../generated/prisma';
import { UserFindOneLocalResponse } from './dto';

type FindUserUniqueInput = Prisma.UserWhereUniqueInput;

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async findOne(where: FindUserUniqueInput): Promise<Omit<User, 'password'>> {
    try {
      return await this.prismaService.user.findUniqueOrThrow({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updated: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      console.error('Error in UserService.findOne:', e);
      throw new InternalServerErrorException('Could not retrieve user.');
    }
  }

  async localFindOne(
    where: FindUserUniqueInput,
  ): Promise<UserFindOneLocalResponse> {
    try {
      return await this.prismaService.user.findUniqueOrThrow({
        where,
        select: {
          id: true,
          email: true,
          password: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      console.error('Error in UserService.findOne:', e);
      throw new InternalServerErrorException('Could not retrieve user.');
    }
  }
}
