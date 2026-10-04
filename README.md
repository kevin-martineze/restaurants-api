# restaurants-api

API multitenant de la plataforma de pedidos y domicilios para restaurantes.
NestJS 11 + Fastify + MongoDB (Mongoose).

- Reglas: [CLAUDE.md](CLAUDE.md)
- Arquitectura: [docs/arquitectura.md](docs/arquitectura.md)
- Modelo de datos: [docs/modelo-de-datos.md](docs/modelo-de-datos.md)
- Estados del pedido: [docs/estados-del-pedido.md](docs/estados-del-pedido.md)
- Producto y decisiones: `../restaurants-suite/docs/`

## Arrancar en local

```sh
pnpm install
cp .env.example .env
pnpm db:up          # Mongo 8 en replica set de un nodo (docker compose)
pnpm start:dev
```

- API: http://localhost:3100/v1
- Swagger: http://localhost:3100/v1/docs
- Salud: http://localhost:3100/v1/health/ready

Con Podman en vez de Docker: `podman compose up -d`.

Mongo corre como replica set incluso en local porque las transacciones y los
change streams solo existen ahí.

## Gates

```sh
pnpm typecheck && pnpm lint:check && pnpm format:check && pnpm test && pnpm build
```
