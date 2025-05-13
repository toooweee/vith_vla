import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthDto } from './dto';
import { TokenService } from '../token/token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register')
  async register(
    @Body() registerDto: AuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(registerDto);
    res.cookie('REFRESH_TOKEN', tokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return {
      accessToken: `Bearer ${tokens.accessToken}`,
    };
  }

  @Post('login')
  async login(
    @Body() loginDto: AuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(loginDto);
    res.cookie('REFRESH_TOKEN', tokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return {
      accessToken: `Bearer ${tokens.accessToken}`,
    };
  }

  @Get('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = request.cookies['REFRESH_TOKEN'];

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const tokens = await this.tokenService.refreshTokens(refreshToken);

    res.cookie('REFRESH_TOKEN', tokens.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 15 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return {
      accessToken: `Bearer ${tokens.accessToken}`,
    };
  }
}
