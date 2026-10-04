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
pnpm db:seed        # restaurante de demostración: /v1/public/la-parrilla-de-tono/menu
pnpm start:dev
```

- API: http://localhost:3100/v1
- Swagger: http://localhost:3100/v1/docs
- Salud: http://localhost:3100/v1/health/ready
- Fotos subidas desde el panel (driver `local`): `./media`, servidas en http://localhost:3100/media

Con Podman en vez de Docker, `podman compose` necesita el socket de Podman
activo (una sola vez: `systemctl --user enable --now podman.socket`). Sin él:

```sh
podman run -d --name restaurants-mongo -p 27017:27017 -v restaurants_mongo_data:/data/db \
  docker.io/library/mongo:8 --replSet rs0 --bind_ip_all
podman exec restaurants-mongo mongosh --quiet --eval \
  "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"
```

Mongo corre como replica set incluso en local porque las transacciones y los
change streams solo existen ahí.

## Gates

```sh
pnpm typecheck && pnpm lint:check && pnpm format:check && pnpm test && pnpm test:e2e && pnpm build
```

`pnpm test:e2e` levanta la API completa contra un replica set de Mongo en
memoria (mongodb-memory-server): no necesita Docker. La primera vez descarga
el binario de Mongo.
