/**
 * Restaurante de demostración: asadero de comida rápida en Barranquilla.
 *
 * FICTICIO. Nombre, dirección y precios son inventados, con la carta típica de
 * la costa. Es la misma carta que usó el frontend en su etapa de fixtures, y la
 * que se carga con `pnpm db:seed` para desarrollo y en las pruebas de
 * integración.
 */

export interface DemoGroup {
  name: string;
  min: number;
  max: number;
  modifiers: { name: string; priceDelta?: number; available?: boolean }[];
}

export interface DemoItem {
  name: string;
  description?: string;
  price: number;
  available?: boolean;
  groups?: string[];
}

export const DEMO_SLUG = 'la-parrilla-de-tono';

export const DEMO_BRAND = {
  name: 'La Parrilla de Toño',
  slug: DEMO_SLUG,
  tagline: 'Asados al carbón y comida rápida',
  theme: { primary: 'oklch(0.52 0.19 33)', primaryForeground: 'oklch(0.99 0 0)' },
};

export const DEMO_BRANCH = {
  name: 'Sede El Prado',
  address: 'El Prado, Barranquilla',
  etaMinutes: 35,
  // Todos los días de 12:00 m. a 11:00 p. m.
  schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '12:00', closes: '23:00' })),
};

export const DEMO_GROUPS: Record<string, DemoGroup> = {
  termino: {
    name: 'Término de la carne',
    min: 1,
    max: 1,
    modifiers: [{ name: 'Medio' }, { name: 'Tres cuartos' }, { name: 'Bien asada' }],
  },
  salsas: {
    name: 'Salsas',
    min: 0,
    max: 2,
    modifiers: [
      { name: 'Rosada' },
      { name: 'Piña' },
      { name: 'Ajo' },
      { name: 'BBQ' },
      { name: 'Tártara', available: false },
    ],
  },
  adicionesHamburguesa: {
    name: 'Adiciones',
    min: 0,
    max: 3,
    modifiers: [
      { name: 'Tocineta', priceDelta: 3000 },
      { name: 'Queso extra', priceDelta: 2500 },
      { name: 'Huevo frito', priceDelta: 2000 },
      { name: 'Maduro', priceDelta: 2500 },
      { name: 'Butifarra', priceDelta: 4000 },
    ],
  },
  adicionesPerro: {
    name: 'Adiciones',
    min: 0,
    max: 3,
    modifiers: [
      { name: 'Tocineta', priceDelta: 3000 },
      { name: 'Queso gratinado', priceDelta: 2500 },
      { name: 'Papita ripio' },
      { name: 'Huevos de codorniz', priceDelta: 3000 },
    ],
  },
  acompananteAsado: {
    name: 'Acompañantes',
    min: 2,
    max: 2,
    modifiers: [
      { name: 'Patacón' },
      { name: 'Yuca frita' },
      { name: 'Papa a la francesa' },
      { name: 'Arroz con coco', priceDelta: 2000 },
      { name: 'Ensalada de la casa' },
    ],
  },
  tamanoPicada: {
    name: 'Tamaño',
    min: 1,
    max: 1,
    modifiers: [
      { name: 'Personal' },
      { name: 'Para 2', priceDelta: 22000 },
      { name: 'Familiar (4 personas)', priceDelta: 52000 },
    ],
  },
  baseJugo: {
    name: 'Preparación',
    min: 1,
    max: 1,
    modifiers: [{ name: 'En agua' }, { name: 'En leche', priceDelta: 1000 }],
  },
  bebidaCombo: {
    name: 'Bebida del combo',
    min: 1,
    max: 1,
    modifiers: [
      { name: 'Kola Román 400 ml' },
      { name: 'Gaseosa 400 ml' },
      { name: 'Jugo de corozo', priceDelta: 2000 },
    ],
  },
};

const burgerGroups = ['termino', 'adicionesHamburguesa', 'salsas'];
const asadoGroups = ['acompananteAsado'];

export const DEMO_CATEGORIES: { name: string; items: DemoItem[] }[] = [
  {
    name: 'Hamburguesas',
    items: [
      {
        name: 'Sencilla',
        description: 'Carne de res de 150 g, queso, lechuga, tomate y papita ripio.',
        price: 18000,
        groups: burgerGroups,
      },
      {
        name: 'Costeña',
        description: 'Carne de 150 g, butifarra, queso costeño asado, suero y maduro.',
        price: 24000,
        groups: burgerGroups,
      },
      {
        name: 'Doble',
        description: 'Dos carnes de 150 g, doble queso y tocineta.',
        price: 26000,
        available: false,
        groups: burgerGroups,
      },
    ],
  },
  {
    name: 'Perros calientes',
    items: [
      {
        name: 'Perro sencillo',
        description: 'Salchicha americana, cebolla, papita ripio y salsas.',
        price: 12000,
        groups: ['adicionesPerro', 'salsas'],
      },
      {
        name: 'Perro suizo',
        description: 'Salchicha suiza, queso gratinado, tocineta y cebolla caramelizada.',
        price: 16000,
        groups: ['adicionesPerro', 'salsas'],
      },
    ],
  },
  {
    name: 'Asados',
    items: [
      {
        name: 'Punta de anca 300 g',
        description: 'Al carbón, con suero costeño y dos acompañantes.',
        price: 38000,
        groups: ['termino', ...asadoGroups],
      },
      {
        name: 'Pechuga asada',
        description: 'Pechuga marinada de 300 g con dos acompañantes.',
        price: 30000,
        groups: asadoGroups,
      },
      {
        name: 'Costillas BBQ',
        description: 'Costillas de cerdo en salsa BBQ de la casa con dos acompañantes.',
        price: 36000,
        groups: asadoGroups,
      },
    ],
  },
  {
    name: 'Picadas',
    items: [
      {
        name: 'Picada de la casa',
        description: 'Res, cerdo, chorizo, butifarra, patacón, yuca y suero.',
        price: 28000,
        groups: ['tamanoPicada', 'salsas'],
      },
    ],
  },
  {
    name: 'Combos',
    items: [
      {
        name: 'Combo hamburguesa sencilla',
        description: 'Hamburguesa sencilla, papa a la francesa y bebida.',
        price: 25000,
        groups: ['termino', 'bebidaCombo', 'salsas'],
      },
    ],
  },
  {
    name: 'Acompañantes',
    items: [
      { name: 'Patacón', price: 6000 },
      { name: 'Yuca frita', price: 6000 },
      { name: 'Arepa de huevo', description: 'Con carne molida.', price: 5000 },
      { name: 'Butifarra (3 unidades)', description: 'Con limón y bollo.', price: 9000 },
    ],
  },
  {
    name: 'Bebidas',
    items: [
      {
        name: 'Jugo de corozo',
        description: 'Natural, 16 oz.',
        price: 6000,
        groups: ['baseJugo'],
      },
      { name: 'Kola Román 400 ml', price: 4500 },
      { name: 'Cerveza nacional', description: 'Lata de 330 ml.', price: 5000 },
      { name: 'Agua', description: '600 ml.', price: 3000 },
    ],
  },
];
