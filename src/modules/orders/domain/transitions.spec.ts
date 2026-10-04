import { checkTransition, TransitionRequest } from './transitions';

function check(overrides: Partial<TransitionRequest>) {
  return checkTransition({
    from: 'received',
    to: 'accepted',
    fulfillment: 'delivery',
    role: 'cashier',
    reason: null,
    ...overrides,
  });
}

describe('checkTransition', () => {
  it('recorre el camino feliz de un domicilio', () => {
    expect(check({})).toEqual({ ok: true });
    expect(check({ from: 'accepted', to: 'preparing', role: 'kitchen' }).ok).toBe(true);
    expect(check({ from: 'preparing', to: 'ready', role: 'kitchen' }).ok).toBe(true);
    expect(check({ from: 'ready', to: 'dispatched', role: 'rider' }).ok).toBe(true);
    expect(check({ from: 'dispatched', to: 'delivered', role: 'rider' }).ok).toBe(true);
  });

  it('un pedido para recoger termina en recogido, no en domicilio', () => {
    expect(check({ from: 'ready', to: 'picked_up', fulfillment: 'pickup' }).ok).toBe(true);
    expect(check({ from: 'ready', to: 'dispatched', fulfillment: 'pickup' })).toEqual({
      ok: false,
      message: 'Este pedido es para recoger: no sale a domicilio.',
    });
    expect(check({ from: 'ready', to: 'picked_up' })).toEqual({
      ok: false,
      message: 'Este pedido es a domicilio: no se recoge en el local.',
    });
  });

  it('no salta estados ni revive pedidos cerrados', () => {
    expect(check({ from: 'received', to: 'ready' })).toEqual({
      ok: false,
      message: 'Un pedido recibido no puede pasar a listo.',
    });
    expect(check({ from: 'delivered', to: 'cancelled', reason: 'customer' }).ok).toBe(false);
    expect(check({ from: 'dispatched', to: 'cancelled', reason: 'customer' }).ok).toBe(false);
  });

  it('cada rol hace lo suyo', () => {
    expect(check({ role: 'kitchen' })).toEqual({
      ok: false,
      message: 'Tu rol no permite este cambio.',
    });
    expect(check({ to: 'cancelled', role: 'rider', reason: 'customer' }).ok).toBe(false);
    expect(check({ from: 'accepted', to: 'preparing', role: 'rider' }).ok).toBe(false);
  });

  it('cancelar exige motivo', () => {
    expect(check({ to: 'cancelled' })).toEqual({
      ok: false,
      message: 'Di por qué se cancela el pedido.',
    });
    expect(check({ to: 'cancelled', reason: 'out_of_stock' }).ok).toBe(true);
  });

  it('un domicilio fallido se reintenta o vuelve al local', () => {
    expect(check({ from: 'dispatched', to: 'failed_delivery', role: 'rider' }).ok).toBe(true);
    expect(check({ from: 'failed_delivery', to: 'dispatched' }).ok).toBe(true);
    expect(check({ from: 'failed_delivery', to: 'returned' }).ok).toBe(true);
  });
});
