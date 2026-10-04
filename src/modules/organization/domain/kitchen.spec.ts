import { kitchenStatus } from './kitchen';

describe('kitchenStatus', () => {
  it('no cambia el tiempo con la cocina al día', () => {
    expect(kitchenStatus('calm', 35)).toEqual({
      load: 'calm',
      label: 'Cocina al día',
      etaMinutes: 35,
    });
  });

  it('suma tiempo cuando hay demanda', () => {
    expect(kitchenStatus('busy', 35).etaMinutes).toBe(50);
    expect(kitchenStatus('saturated', 35)).toMatchObject({
      label: 'Cocina a tope',
      etaMinutes: 65,
    });
  });
});
