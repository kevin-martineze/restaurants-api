import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { AuthenticatedUser } from '@shared/auth/staff';
import { CurrentUser } from '@shared/auth/staff.decorator';

import { LoginDto } from '../dtos/login.dto';
import { AuthService, Session, SessionProfile } from '../providers/auth.service';

@ApiTags('acceso')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  // Por IP: frena a quien prueba contraseñas sin bloquear la cuenta de nadie.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Entrar con correo y contraseña. Devuelve el token y los restaurantes.',
  })
  login(@Body() body: LoginDto): Promise<Session> {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quién soy y dónde trabajo hoy.' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SessionProfile> {
    return this.auth.profile(new Types.ObjectId(user.id));
  }
}
