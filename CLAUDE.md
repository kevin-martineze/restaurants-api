# CLAUDE.md — Reglas de la API

Léelo entero antes de generar código. Cualquier desviación necesita
justificación explícita y queda anotada en
`../restaurants-suite/docs/decisiones.md`.

API multitenant de la plataforma de pedidos y domicilios para restaurantes.
Stack: **NestJS 11 + Fastify + MongoDB (Mongoose) + TypeScript strict**.
Frontend: `../restaurants-suite`. Documentación del producto:
`../restaurants-suite/docs/`. Documentación técnica: `docs/`.

---

## 1. TypeScript

1. **Prohibido `any`.** Usa `unknown` con guardas.
2. **Prohibido `as`** salvo para tipos de Mongoose que no se pueden expresar de
   otra forma, y con comentario que diga por qué.
3. **Prohibido `@ts-ignore` / `@ts-expect-error`.**
4. **Prohibido `console.log`.** Usa el `Logger` de Nest. Nunca loguees datos de
   clientes (teléfono, dirección, nombre) ni secretos.

## 2. Estructura

- `src/modules/<dominio>/` con `controllers/`, `providers/` (servicios y
  repositorios), `schemas/` (Mongoose) y `dtos/`.
- `src/shared/` para lo transversal: config, tenancy, errores, integraciones
  (Wompi, WhatsApp, almacenamiento, IA).
- Alias: `@shared/*`, `@modules/*`. Si agregas uno, agrégalo también en
  `jest.config.js`.
- Tres superficies HTTP:
  - `/public/:slug/*`: carta, cotización y pedidos del cliente. Sin sesión.
    Throttle propio en los endpoints que escriben.
  - `/tenants/:tenantId/*`: panel, cocina y domiciliario. Sesión + membresía.
  - `/platform/*`: administración de la plataforma.

## 3. Multitenancy (no negociable)

Mongo no tiene RLS: el aislamiento lo garantiza el código.

5. **Todo documento de negocio lleva `tenantId`.** Los que son de una sucursal,
   también `branchId`.
6. **Los servicios nunca usan el `Model` directamente.** Pasan por un
   repositorio que recibe el `tenantId` y lo agrega a **toda** consulta,
   actualización y agregación (`$match` primero).
7. **Todo índice compuesto empieza por `tenantId`.**
8. **El `tenantId` sale de la sesión o del slug resuelto, nunca del cuerpo de la
   petición.**
9. Toda funcionalidad nueva lleva una prueba que confirma que un tenant no ve
   datos de otro.

## 4. Datos

10. **Dinero en pesos enteros** (`number` entero). COP no usa decimales. Nada de
    flotantes con centavos.
11. **Los precios los calcula la API.** El cliente manda ids y cantidades. La
    cotización y la creación del pedido usan la misma función de precio.
12. **El pedido guarda snapshots**: nombre, precio unitario y modificadores
    tal como estaban al comprar. Editar el menú no altera pedidos viejos.
13. **Estados en inglés**, definidos como constantes en un solo archivo. Las
    transiciones válidas viven en una sola función; ningún servicio cambia
    `status` sin pasar por ella (ver `docs/estados-del-pedido.md`).
14. **El estado del pago va separado del estado del pedido.**
15. **Toda transición de pedido agrega un evento** (`status`, actor, fecha,
    ubicación si la hay). El historial es de solo agregar.
16. **Escrituras que tocan varios documentos van en transacción** (sesión de
    Mongo). Por eso la base siempre corre en replica set.
17. **Embeber lo que se lee junto y está acotado** (líneas del pedido,
    direcciones de un cliente). **Referenciar lo que crece sin límite** (pedidos
    de un cliente, ubicaciones del domiciliario).
18. Los esquemas Mongoose usan `strict: true` y `timestamps: true`.

## 5. Entradas y salidas

19. **DTOs con class-validator** en toda entrada. El pipe global rechaza campos
    no declarados.
20. **Los mensajes de error van en español**, listos para mostrar al dueño del
    restaurante o al cliente. Nada de "ValidationError: path…".
21. **Las respuestas nunca exponen** `_id` crudos de Mongo sin convertir, ni
    campos internos (tokens de WhatsApp, llaves de Wompi).
22. **Webhooks (Wompi, WhatsApp): verificar firma e idempotencia** antes de
    hacer nada.
23. **Los secretos de terceros por tenant se guardan cifrados.**

## 6. Imports

Orden (lo hace cumplir ESLint): tipos → builtin → externos → `@shared` /
`@modules` → padres → hermanos. Línea en blanco entre grupos.

## 7. Gates

`pnpm typecheck`, `pnpm lint:check`, `pnpm format:check`, `pnpm test` y
`pnpm build` deben pasar.

## 8. Antes de crear algo nuevo

Lee el documento de `docs/` que corresponde. Si existe un módulo equivalente en
este repo, replica su patrón; si no, el referente es `../ecommerce-api`, que
sigue el mismo estilo (con Prisma en vez de Mongoose).
