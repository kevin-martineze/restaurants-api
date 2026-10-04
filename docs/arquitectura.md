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

- Autocompletar con Google Places (con sesión, para controlar el costo).
- **Pin obligatorio** + barrio + referencias: el geocodificador falla con las
  direcciones de la costa.
- Zonas de cobertura como polígonos GeoJSON con índice `2dsphere`.

## Infraestructura

- Contenedores (Docker o Podman) detrás de Caddy, como en Globerce.
- Mongo: Atlas o propio, siempre replica set. Respaldos diarios.
- Sentry y monitor de disponibilidad antes del piloto.
