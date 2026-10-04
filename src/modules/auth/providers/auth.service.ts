import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { Env } from '@shared/config/env';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';
import { BrandsRepository } from '@modules/organization/providers/brands.repository';
import { TenantsRepository } from '@modules/organization/providers/tenants.repository';

import { Role } from '../schemas/membership.schema';

import { MembershipsRepository } from './memberships.repository';
import { PasswordService } from './password.service';
import { UsersRepository } from './users.repository';

/** Un restaurante donde trabaja la persona, con lo que el panel necesita para pintarse. */
export interface SessionMembership {
  tenantId: string;
  tenantName: string;
  role: Role;
  brands: { id: string; name: string; slug: string }[];
  /** Solo las sedes donde trabaja. */
  branches: { id: string; name: string }[];
}

export interface SessionProfile {
  user: { id: string; name: string; email: string };
  memberships: SessionMembership[];
}

export interface Session extends SessionProfile {
  accessToken: string;
  /** ISO. El panel cierra la sesión al llegar aquí. */
  expiresAt: string;
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'invalid_credentials',
    message: 'Correo o contraseña incorrectos.',
  });
}

@Injectable()
export class AuthService {
  /** Hash de relleno para que un correo inexistente tarde lo mismo que uno real. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UsersRepository,
    private readonly memberships: MembershipsRepository,
    private readonly passwords: PasswordService,
    private readonly tenants: TenantsRepository,
    private readonly brands: BrandsRepository,
    private readonly branches: BranchesRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<Session> {
    const user = await this.users.findByEmail(email);

    if (!user || !user.active) {
      this.dummyHash ??= this.passwords.hash('relleno-para-igualar-tiempos');
      await this.passwords.verify(await this.dummyHash, password);

      throw invalidCredentials();
    }

    if (!(await this.passwords.verify(user.passwordHash, password))) throw invalidCredentials();

    const profile = await this.profile(user._id);

    if (profile.memberships.length === 0) {
      throw new ForbiddenException({
        error: 'no_memberships',
        message: 'Tu cuenta todavía no tiene acceso a ningún restaurante.',
      });
    }

    const accessToken = await this.jwt.signAsync(
      { sub: user._id.toString(), email: user.email },
      { expiresIn: this.config.get('JWT_TTL', { infer: true }) },
    );
    const decoded: unknown = this.jwt.decode(accessToken);
    const exp =
      typeof decoded === 'object' && decoded !== null ? Reflect.get(decoded, 'exp') : null;

    return {
      ...profile,
      accessToken,
      expiresAt: new Date((typeof exp === 'number' ? exp : 0) * 1000).toISOString(),
    };
  }

  /** Quién es y dónde trabaja hoy. El panel lo vuelve a pedir para no quedarse viejo. */
  async profile(userId: Types.ObjectId): Promise<SessionProfile> {
    const user = await this.users.findById(userId);

    if (!user || !user.active) {
      throw new UnauthorizedException({
        error: 'unauthenticated',
        message: 'Tu sesión venció. Vuelve a entrar.',
      });
    }

    const memberships = await this.memberships.forUser(user._id);
    const detailed = await Promise.all(
      memberships.map(async (membership): Promise<SessionMembership | null> => {
        const tenant = await this.tenants.findById(membership.tenantId);

        if (!tenant || tenant.status !== 'active') return null;

        const [brands, branches] = await Promise.all([
          this.brands.find(membership.tenantId),
          this.branches.find(membership.tenantId),
        ]);
        const allowed =
          membership.branchIds.length === 0
            ? branches
            : branches.filter((branch) => membership.branchIds.some((id) => id.equals(branch._id)));

        return {
          tenantId: membership.tenantId.toString(),
          tenantName: tenant.name,
          role: membership.role,
          brands: brands.map((brand) => ({
            id: brand._id.toString(),
            name: brand.name,
            slug: brand.slug,
          })),
          branches: allowed.map((branch) => ({ id: branch._id.toString(), name: branch.name })),
        };
      }),
    );

    return {
      user: { id: user._id.toString(), name: user.name, email: user.email },
      memberships: detailed.filter((membership) => membership !== null),
    };
  }
}
