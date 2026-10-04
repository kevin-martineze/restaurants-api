import { KitchenLoad } from '../schemas/branch.schema';

export interface KitchenStatus {
  load: KitchenLoad;
  /** Texto para el cliente: "Cocina al día", "Mucha demanda"… */
  label: string;
  /** Tiempo estimado ya corregido por la carga, en minutos. */
  etaMinutes: number;
}

/** Minutos que se suman al tiempo estimado según la carga de la cocina. */
export const KITCHEN_DELAY_MINUTES: Record<KitchenLoad, number> = {
  calm: 0,
  busy: 15,
  saturated: 30,
};

const LABEL: Record<KitchenLoad, string> = {
  calm: 'Cocina al día',
  busy: 'Mucha demanda',
  saturated: 'Cocina a tope',
};

/**
 * El estado de la cocina como lo ve el cliente antes de pedir.
 *
 * El tiempo estimado se corrige aquí y no en el frontend: el que promete la
 * carta es el mismo que se guardará en el pedido.
 */
export function kitchenStatus(load: KitchenLoad, baseEtaMinutes: number): KitchenStatus {
  return {
    load,
    label: LABEL[load],
    etaMinutes: baseEtaMinutes + KITCHEN_DELAY_MINUTES[load],
  };
}
