import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { Env } from '@shared/config/env';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { TenantRolesGuard } from '@shared/auth/tenant-roles.guard';
import { OrganizationModule } from '@modules/organization/organization.module';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './providers/auth.service';
import { MembershipsRepository } from './providers/memberships.repository';
import { PasswordService } from './providers/password.service';
import { UsersRepository } from './providers/users.repository';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { User, UserSchema } from './schemas/user.schema';

/**
 * Global: cualquier módulo puede proteger sus rutas con `@StaffRoute` sin
 * importar este módulo, porque los guards necesitan sus repositorios.
 */
@Global()
@Module({
  imports: [
    OrganizationModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    UsersRepository,
    MembershipsRepository,
    PasswordService,
    AuthService,
    JwtAuthGuard,
    TenantRolesGuard,
  ],
  exports: [
    UsersRepository,
    MembershipsRepository,
    PasswordService,
    JwtModule,
    JwtAuthGuard,
    TenantRolesGuard,
  ],
})
export class AuthModule {}
