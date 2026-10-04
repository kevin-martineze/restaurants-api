import { formatCop } from './money';

describe('formatCop', () => {
  it('usa punto de miles y no lleva decimales', () => {
    expect(formatCop(45000)).toBe('$45.000');
    expect(formatCop(1250000)).toBe('$1.250.000');
    expect(formatCop(0)).toBe('$0');
  });
});
