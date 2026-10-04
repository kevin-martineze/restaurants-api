# Estados del pedido

Los estados se guardan en inglés y se traducen al pintarlos.

## Pedido

```
received → accepted → preparing → ready ─┬→ dispatched → delivered      (domicilio)
                                         ├→ picked_up                   (recoger)
                                         └→ served                      (mesa)

received | accepted | preparing | ready → cancelled   (motivo obligatorio)
dispatched → failed_delivery → returned
```

| Estado            | Etiqueta            | Quién lo pone                        |
| ----------------- | ------------------- | ------------------------------------ |
| `received`        | Recibido            | Sistema, al crear el pedido          |
| `accepted`        | Aceptado            | Cajero / gerente                     |
| `preparing`       | En cocina           | Cocina                               |
| `ready`           | Listo               | Cocina                               |
| `dispatched`      | En camino           | Domiciliario (al recoger) o cajero   |
| `delivered`       | Entregado           | Domiciliario, con código del cliente |
| `picked_up`       | Recogido            | Cajero                               |
| `served`          | Servido             | Mesero / cajero                      |
| `cancelled`       | Cancelado           | Cajero / gerente / sistema           |
| `failed_delivery` | No se pudo entregar | Domiciliario                         |
| `returned`        | Devuelto al local   | Cajero                               |

Motivos de cancelación: `customer`, `out_of_stock`, `out_of_coverage`,
`payment_failed`, `restaurant`.

## Pago (separado del pedido)

```
pending → paid | failed
paid → refunded
cash_on_delivery → collected
```

Un pedido con pago en línea no pasa a `accepted` mientras el pago esté
`pending`, salvo que el restaurante lo acepte a mano.

## Reglas

- Las transiciones válidas viven en **una sola función**; ningún servicio
  escribe `status` directamente.
- Cada transición agrega un evento: `{ status, actorId, actorRole, at,
location?, reason? }`.
- Cada transición puede disparar efectos (WhatsApp al cliente, alerta,
  impresión). Los efectos van por cola, no dentro de la petición.
