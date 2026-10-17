# Arquitectura

## Piezas

```
Cliente (celular) ──► restaurants-suite (SvelteKit, SSR) ──► restaurants-api (NestJS + Fastify) ──► MongoDB (replica set)
Tablero / cocina  ◄── SSE (ruta de SvelteKit) ◄────────── eventos (change streams / Redis)
                                                          ├─► Redis + BullMQ (colas, alertas)      [rebanada 3]
                                                          ├─► WhatsApp Cloud API (Meta)            [rebanada 5]
                                                          ├─► Wompi (pagos + webhooks)             [rebanada 2]
                                                          ├─► S3 / R2 (fotos)
                                                          └─► Anthropic (menú desde foto)
```

El navegador nunca habla con la API: todo pasa por el servidor de SvelteKit.
Por eso `CORS_ORIGINS` va vacío por defecto.

## Superficies HTTP

| Prefijo                          | Quién                                           | Auth                                       |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `/v1/public/:slug/*`             | Cliente: carta, cotización, pedido, seguimiento | Ninguna. Throttle propio en lo que escribe |
| `/v1/tenants/:tenantId/*`        | Panel, cajero, cocina, domiciliario             | Sesión + membresía con rol                 |
| `/v1/platform/*`                 | Administración de la plataforma                 | Admin de plataforma                        |
| `/v1/webhooks/*`                 | Wompi, WhatsApp                                 | Firma del proveedor                        |
| `/v1/health`, `/v1/health/ready` | Orquestador                                     | Ninguna                                    |

## Acceso del equipo

- Usuarios de la plataforma (`users`, contraseña con argon2id) y membresías
  por restaurante (`memberships`: rol y sedes).
- `POST /v1/auth/login` devuelve un JWT de 12 horas (un turno) y los
  restaurantes y sedes de la persona. Todavía sin token de renovación: al
  vencer, se vuelve a entrar.
- `@StaffRoute(...roles)` protege una ruta del panel: valida el token y
  consulta la membresía **en cada petición**, así quitar el acceso surte
  efecto de inmediato.

## Tiempo real del tablero

`GET /v1/tenants/:tenantId/branches/:branchId/orders/events` es un stream SSE
con un aviso por pedido creado o movido y un latido cada 25 s. Hoy los avisos
viajan en memoria (`OrderEventsBus`): sirve con una sola instancia de la API.
Con varias, se cambia por Redis pub/sub sin tocar a quien publica ni a quien
escucha.

## Configuración de la sede

`GET` y `PUT /v1/tenants/:tenantId/branches/:branchId/settings` leen y guardan
la configuración de una sede: nombre, dirección, horario (varios turnos por
día, con cierre pasada la medianoche), ETA, formas de entrega, ubicación,
anillos de cobertura y medios de pago. Solo dueño y gerente
(`@StaffRoute('owner', 'manager')`), con `canWorkInBranch`. La carta lee esta
configuración en vivo de la sucursal, así que guardar no pide republicar el
menú.

## Multitenancy

Base compartida, aislamiento por `tenantId` en cada documento y una capa de
repositorio que lo agrega a toda consulta (ver `CLAUDE.md`, sección 3).
Jerarquía: **Tenant → Brand → Branch**. Un restaurante normal tiene una marca y
una o más sucursales; una dark kitchen, varias marcas sobre la misma sucursal.

El slug público identifica a la marca (o marca + sucursal). Se resuelve a
`tenantId` en el servidor, nunca se acepta del cliente.

## Tiempo real

- Los cambios de pedido se publican como eventos internos.
- La web los recibe por **SSE** a través de una ruta propia de SvelteKit.
- Con más de una instancia de la API, los eventos pasan por Redis pub/sub.
- Los change streams de Mongo sirven para no perder eventos si una instancia se
  reinicia.

## Colas (BullMQ sobre Redis)

- Envío de WhatsApp con reintentos y registro del estado del mensaje.
- Temporizadores: pedido sin aceptar (3 min), pedido demorado, pago pendiente.
- Procesamiento de webhooks fuera del ciclo de la petición.

## Integraciones

### Wompi

- Cada restaurante conecta su cuenta; las llaves se guardan cifradas.
- Webhook con verificación de firma e idempotencia por referencia de
  transacción.
- Métodos: Nequi, PSE, tarjeta, Bancolombia. Efectivo y contraentrega no pasan
  por Wompi.

### WhatsApp Cloud API

- Embedded Signup: cada restaurante conecta su propio número.
- Mensajes iniciados por el cliente: dentro de la ventana de 24 h se responde
  con texto libre (el link mágico de la carta).
- Confirmación y cambios de estado: plantillas **utility** aprobadas.
- Reorden y promociones: plantillas **marketing**, solo con opt-in. V2.
- Verificar la tarifa vigente por mensaje para Colombia antes de fijar precios.

### Mapas y direcciones

- Pin en un mapa OSM sin geocodificar: se arrastra el marcador y se guardan
  latitud y longitud. El geocodificador falla con las direcciones de la costa,
  así que se piden además barrio y referencias.
- Zonas de cobertura como anillos por distancia (polígonos después, detrás de
  `coverageFor`).

## Infraestructura

- Frontend en Vercel (`adapter-vercel`, Node 22, región iad1).
- Backend y sus servicios en AWS (región us-east-1, junto a iad1).
- API en EC2 como contenedor Docker.
- MongoDB en Atlas sobre AWS us-east-1 (replica set, transacciones y change
  streams, como hoy).
- Fotos en S3 con el driver `s3` que ya existe.
- Pendientes: Redis (pub/sub, colas y cache) y TLS (Caddy en la misma EC2 o un
  ALB).
