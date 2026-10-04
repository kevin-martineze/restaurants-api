/** "$45.000": como se escribe la plata en Colombia, sin decimales. */
export function formatCop(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CO').replace(/,/g, '.')}`;
}
