/**
 * Reglas de la marca: qué color se acepta y cuál es el texto que se lee
 * encima. La carta aplica el color como variable CSS, así que solo entra un
 * formato conocido: hex u `oklch(...)` numérico.
 */

const COLOR = /^(#[0-9a-f]{3,8}|oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+%?)?\s*\))$/i;

/** El texto claro: blanco. */
export const FOREGROUND_LIGHT = 'oklch(1 0 0)';

/** El texto oscuro: casi negro, el mismo neutro de la plantilla base. */
export const FOREGROUND_DARK = 'oklch(0.2 0 0)';

export function isSafeColor(value: string): boolean {
  return COLOR.test(value.trim());
}

type Rgb = [number, number, number];

function clamp255(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel * 255)));
}

function toSrgb(linear: number): number {
  return linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
}

function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace('#', '');

  if (!/^[0-9a-f]{3,8}$/i.test(clean)) return null;

  if (clean.length === 3 || clean.length === 4) {
    return [
      parseInt(clean[0]! + clean[0], 16),
      parseInt(clean[1]! + clean[1], 16),
      parseInt(clean[2]! + clean[2], 16),
    ];
  }

  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** `oklch(L C H [/ alfa])` numérico, con H en grados. El alfa no pesa en el contraste. */
function oklchToRgb(color: string): Rgb | null {
  const match = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(
    color.trim(),
  );

  if (!match) return null;

  const l = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  // OKLab → LMS.
  const lmsL = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const lmsM = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const lmsS = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  // LMS → sRGB lineal.
  const linearR = 4.0767416621 * lmsL - 3.3077115913 * lmsM + 0.2309699292 * lmsS;
  const linearG = -1.2684380046 * lmsL + 2.6097574011 * lmsM - 0.3413193965 * lmsS;
  const linearB = -0.0041960863 * lmsL - 0.7034186147 * lmsM + 1.707614701 * lmsS;

  return [clamp255(toSrgb(linearR)), clamp255(toSrgb(linearG)), clamp255(toSrgb(linearB))];
}

function channelLuminance(channel: number): number {
  const s = channel / 255;

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa WCAG de un color hex u oklch. Un color inválido cuenta como negro. */
export function relativeLuminance(color: string): number {
  const value = color.trim();
  const rgb = value.startsWith('#') ? hexToRgb(value) : oklchToRgb(value);

  if (!rgb) return 0;

  const [red, green, blue] = rgb;

  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

function contrast(light: number, dark: number): number {
  return (light + 0.05) / (dark + 0.05);
}

/** Blanco si el color es oscuro, casi negro si es claro: el que más contraste da. */
export function primaryForeground(primary: string): string {
  const luminance = relativeLuminance(primary);

  return contrast(1, luminance) >= contrast(luminance, relativeLuminance(FOREGROUND_DARK))
    ? FOREGROUND_LIGHT
    : FOREGROUND_DARK;
}
