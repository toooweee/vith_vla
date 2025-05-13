import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserPayload } from '../user/types';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { Prisma } from 'generated/prisma';

@Injectable()
export class TokenService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async generateTokens(payload: UserPayload) {
    const [accessTokenSecret, refreshTokenSecret] = await Promise.all([
      this.configService.get<string>('JWT_AT_SECRET'),
      this.configService.get<string>('JWT_RT_SECRET'),
    ]);

    const [accessTokenExpires, refreshTokenExpires] = await Promise.all([
      this.configService.get<string>('JWT_AT_EXPIRES_IN') || '15m',
      this.configService.get<string>('JWT_RT_EXPIRES_IN') || '7d',
    ]);

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessTokenSecret,
      expiresIn: accessTokenExpires,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshTokenSecret,
      expiresIn: refreshTokenExpires,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async saveRefreshToken(userId: number, refreshToken: string) {
    return this.prismaService.token.upsert({
      where: {
        userId,
      },
      update: {
        token: refreshToken,
      },
      create: {
        token: refreshToken,
        userId,
      },
    });
  }

  async verifyRefreshToken(token: string) {
    const secret = this.configService.get<string>('JWT_RT_SECRET');
    const payload = await this.jwtService.verifyAsync(token, {
      secret,
    });

    if (!payload) {
      throw new UnauthorizedException();
    }

    return payload;
  }

  async refreshTokens(refreshToken: string) {
    try {
      await this.findRefreshToken(refreshToken);
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new UnauthorizedException();
      }
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);

      const { id, email } = payload;

      return await this.generateTokens({ id, email });
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }

      console.error(e);
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  private async findRefreshToken(refreshToken: string) {
    try {
      return this.prismaService.token.findUnique({
        where: {
          token: refreshToken,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('Token not found');
      }

      console.error(e);
      throw new InternalServerErrorException('Something went wrong');
    }
  }
}
