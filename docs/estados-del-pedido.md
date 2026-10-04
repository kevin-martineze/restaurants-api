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

## Quién mueve qué

| Hacia                                            | Roles                              |
| ------------------------------------------------ | ---------------------------------- |
| `accepted`, `cancelled`, `picked_up`, `returned` | dueño, gerente, caja               |
| `preparing`, `ready`                             | dueño, gerente, caja, cocina       |
| `dispatched`, `delivered`, `failed_delivery`     | dueño, gerente, caja, domiciliario |

Cancelar exige motivo: `customer`, `out_of_stock`, `out_of_coverage`,
`restaurant`, `other`. Al llegar a `delivered` o `picked_up`, el pago contra
entrega queda `collected`.

La regla vive en `src/modules/orders/domain/transitions.ts` (`checkTransition`),
con pruebas de cada camino. Si dos personas mueven el mismo pedido a la vez,
gana la primera: la segunda recibe un 409 en vez de pisar el cambio.

## Reglas

- Las transiciones válidas viven en **una sola función**; ningún servicio
  escribe `status` directamente.
- Cada transición agrega un evento: `{ status, actorId, actorRole, at,
location?, reason? }`.
- Cada transición puede disparar efectos (WhatsApp al cliente, alerta,
  impresión). Los efectos van por cola, no dentro de la petición.
