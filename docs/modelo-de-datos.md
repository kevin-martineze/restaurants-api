# Modelo de datos (MongoDB)

Criterio general: **embeber lo que se lee junto y está acotado; referenciar lo
que crece sin límite.** Todo documento de negocio lleva `tenantId`, y todo
índice compuesto empieza por él.

Dinero: pesos enteros. Fechas: `Date` en UTC; la zona horaria del restaurante
(`America/Bogota`) se aplica al mostrar y al evaluar horarios.

## Colecciones

### Organización

```
tenants      { _id, name, plan, status, createdAt }
brands       { _id, tenantId, name, slug (único), theme { templateId, colors, logoUrl, font, bannerUrl } }
branches     { _id, tenantId, brandIds[], name, slug, address, location: GeoJSON Point,
               timezone, schedule [{ day, opens, closes }], status: open|paused|closed,
               prepTimeMinutes, paymentMethods[] }
deliveryZones{ _id, tenantId, branchId, name, area: GeoJSON Polygon (2dsphere),
               fee, minOrder, etaMinutes, active }
users        { _id, email, phone, passwordHash, name }
memberships  { _id, tenantId, userId, role: owner|manager|cashier|kitchen|rider, branchIds[] }
```

### Menú (modelo de escritura)

```
categories     { _id, tenantId, brandId, name, position, active }
items          { _id, tenantId, brandId, categoryId, name, description, price,
                 imageUrl, available, position,
                 modifierGroupIds[] }               ← referencias: un grupo se reutiliza
modifierGroups { _id, tenantId, brandId, name, min, max,
                 modifiers [{ _id, name, priceDelta, available }] }   ← embebidos: acotados
branchItems    { _id, tenantId, branchId, itemId, price?, available?, soldOutUntil? }
```

- Obligatorio = `min ≥ 1`. Opcional = `min = 0`.
- Un combo es un `item` con sus grupos ("Elige tu bebida").
- `branchItems` solo existe cuando la sucursal cambia algo; si no, manda el
  valor de `items`.

### Menú publicado (modelo de lectura)

```
menuSnapshots { _id, tenantId, brandId, branchId, version, publishedAt,
                categories [{ id, name, items [{ id, name, description, price, imageUrl,
                  available, groups [{ id, name, min, max, modifiers [...] }] }] }] }
```

La carta lee **un solo documento** por sucursal. Se regenera al editar el menú
o al marcar un agotado. La cotización valida contra este snapshot y contra
`branchItems` para los agotados de último momento.

### Clientes

```
customers { _id, tenantId, phone (E.164), name,
            consent { utility: bool, marketing: bool, at, version },
            addresses [{ _id, label, text, neighborhood, references, location: Point,
                         facadePhotoUrl?, verified }],      ← embebidas: acotadas
            stats { orders, lastOrderAt, noShows } }
```

Índice único: `{ tenantId, phone }`. Un mismo teléfono en dos restaurantes son
dos clientes distintos: el cliente es de cada restaurante.

### Pedidos

```
orders {
  _id, tenantId, brandId, branchId, number (consecutivo por sucursal),
  channel: web|whatsapp|qr|manual, fulfillment: delivery|pickup|dine_in,
  customer { customerId, name, phone },                      ← snapshot
  address  { text, neighborhood, references, location },     ← snapshot
  items [{ itemId, name, unitPrice, qty, note,
           modifiers [{ modifierId, groupName, name, priceDelta }] }],   ← snapshots
  totals { subtotal, deliveryFee, discount, total },
  status, events [{ status, actorId, actorRole, at, location?, reason? }],
  payment { method, status, provider?, providerRef?, amount, cashTendered? },
  delivery? { riderId, assignedAt, pickedAt, deliveredAt, otpHash, proofPhotoUrl },
  createdAt, updatedAt
}
```

Índices: `{ tenantId, branchId, status, createdAt }` (tablero),
`{ tenantId, customer.customerId, createdAt }` (historial),
`{ tenantId, branchId, number }` único.

`events` se embebe porque está acotado (unas 10 a 20 transiciones).

### Operación

```
payments      { _id, tenantId, orderId, provider, providerRef (único), status, raw, receivedAt }   ← webhooks
riderPings    time series { meta: { tenantId, riderId, orderId? }, at, location, accuracy }, TTL 30 días
messageLogs   { _id, tenantId, orderId?, customerId, template, waMessageId, status, at }
whatsappAccounts { _id, tenantId, wabaId, phoneNumberId, accessToken (cifrado), status }
paymentAccounts  { _id, tenantId, provider: wompi, publicKey, privateKey (cifrado), eventsSecret (cifrado) }
```

## Transacciones

Van en transacción (sesión de Mongo):

- Crear pedido + incrementar el consecutivo de la sucursal.
- Webhook de pago + actualizar `orders.payment` + evento.
- Marcar agotado + regenerar el snapshot del menú.
