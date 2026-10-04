/**
 * Pruebas de integración: la API completa contra un replica set de Mongo en
 * memoria (mongodb-memory-server). No necesitan Docker ni una base levantada.
 *
 * Los alias se repiten aquí porque Jest no lee `paths` de tsconfig.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  // La primera corrida descarga el binario de Mongo.
  testTimeout: 120_000,
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
};
