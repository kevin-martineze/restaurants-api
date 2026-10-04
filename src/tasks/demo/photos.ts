/**
 * Fotos del restaurante de demostración.
 *
 * Todas de Wikimedia Commons, con licencia libre (CC0, CC BY, CC BY-SA o
 * dominio público). Se enlazan a la miniatura de Commons, que permite
 * enlazarlas directamente; el crédito de cada una va aquí y en
 * docs/creditos-fotos-demo.md. Son solo para desarrollo: un restaurante real
 * sube las suyas.
 */

export interface DemoPhoto {
  url: string;
  author: string;
  license: string;
  source: string;
}

export const DEMO_PHOTOS: Record<string, DemoPhoto> = {
  cover: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Asado_argentino_en_parrilla_a_carb%C3%B3n.jpg',
    author: 'by felixion from Argentina',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Asado_argentino_en_parrilla_a_carb%C3%B3n.jpg',
  },
  Sencilla: {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Cultivated_hamburger%2C_2013.jpg/960px-Cultivated_hamburger%2C_2013.jpg',
    author: 'Mosa Meat',
    license: 'CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Cultivated_hamburger,_2013.jpg',
  },
  Costeña: {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Hamburguesa_casera_cocinada_a_la_plancha_en_Argentina.jpg/960px-Hamburguesa_casera_cocinada_a_la_plancha_en_Argentina.jpg',
    author: 'Horacio Cambeiro',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Hamburguesa_casera_cocinada_a_la_plancha_en_Argentina.jpg',
  },
  Doble: {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Hamburger_v.jpg/960px-Hamburger_v.jpg',
    author: 'IldaMe',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Hamburger_v.jpg',
  },
  'Perro sencillo': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Hot_Dog_09.jpg/960px-Hot_Dog_09.jpg',
    author: 'rob_rob2001',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Hot_Dog_09.jpg',
  },
  'Perro suizo': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/Hot_dog_-_4101498180.jpg/960px-Hot_dog_-_4101498180.jpg',
    author: 'stu_spivack',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Hot_dog_-_4101498180.jpg',
  },
  'Punta de anca 300 g': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Steak_auf_Grill.jpg',
    author: 'Jon Sullivan',
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Steak_auf_Grill.jpg',
  },
  'Pechuga asada': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Grilled_Chicken_Breasts_%2828905381261%29.jpg/960px-Grilled_Chicken_Breasts_%2828905381261%29.jpg',
    author: 'Sharon Chen from Austin, United States',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Grilled_Chicken_Breasts_(28905381261).jpg',
  },
  'Costillas BBQ': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Mmm..._more_ribs_%284728201699%29.jpg/960px-Mmm..._more_ribs_%284728201699%29.jpg',
    author: 'jeffreyw',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mmm..._more_ribs_(4728201699).jpg',
  },
  'Picada de la casa': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Chicharr%C3%B3n_Plato_tradicional_de_la_ciudad_de_Cochabamba_07.jpg/960px-Chicharr%C3%B3n_Plato_tradicional_de_la_ciudad_de_Cochabamba_07.jpg',
    author: 'Albaro2020',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Chicharr%C3%B3n_Plato_tradicional_de_la_ciudad_de_Cochabamba_07.jpg',
  },
  'Combo hamburguesa sencilla': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg/960px-Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg',
    author: 'Andy Li',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Fancy_Veggie_Burger_and_Fries_-_Joe%27s_Burger_House_2024-07-07.jpg',
  },
  Patacón: {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Tostones_-_Arnold_Gatilao.jpg/960px-Tostones_-_Arnold_Gatilao.jpg',
    author: 'Arnold Gatilao from Fremont, CA, USA',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Tostones_-_Arnold_Gatilao.jpg',
  },
  'Yuca frita': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Mandioca_frita_en_restaurante_de_Argentina.jpg/960px-Mandioca_frita_en_restaurante_de_Argentina.jpg',
    author: 'Horacio Cambeiro',
    license: 'CC BY-SA 3.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Mandioca_frita_en_restaurante_de_Argentina.jpg',
  },
  'Arepa de huevo': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Arepas_de_huevo.jpg/960px-Arepas_de_huevo.jpg',
    author: 'Jdvillalobos',
    license: 'CC BY 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Arepas_de_huevo.jpg',
  },
  'Butifarra (3 unidades)': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Butifarras_solede%C3%B1as.jpg/960px-Butifarras_solede%C3%B1as.jpg',
    author: 'Jdvillalobos',
    license: 'CC BY 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Butifarras_solede%C3%B1as.jpg',
  },
  'Jugo de corozo': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Tow_Glass_of_Watermelon_Juice.jpg/960px-Tow_Glass_of_Watermelon_Juice.jpg',
    author: 'Hiteshnchavda',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Tow_Glass_of_Watermelon_Juice.jpg',
  },
  'Kola Román 400 ml': {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Watermelon_juice_in_a_glass.jpg/960px-Watermelon_juice_in_a_glass.jpg',
    author: 'Susan Slater',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Watermelon_juice_in_a_glass.jpg',
  },
  'Cerveza nacional': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Lav_beer_and_glass_-_2012-10-12_-_Andy_Mabbett.jpg',
    author: 'Andy Mabbett',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Lav_beer_and_glass_-_2012-10-12_-_Andy_Mabbett.jpg',
  },
  Agua: {
    url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Fasting_4-Fasting-a-glass-of-water-on-an-empty-plate.jpg/960px-Fasting_4-Fasting-a-glass-of-water-on-an-empty-plate.jpg',
    author: 'Dr Jean Fortunet',
    license: 'CC BY-SA 3.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Fasting_4-Fasting-a-glass-of-water-on-an-empty-plate.jpg',
  },
};
