import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = {
    MONGODB_URI: 'mongodb://localhost:27017/restaurants?replicaSet=rs0',
    JWT_SECRET: 'un-secreto-de-prueba-de-al-menos-32-caracteres',
  };

  it('aplica los valores por defecto', () => {
    const env = validateEnv(base);

    expect(env.PORT).toBe(3100);
    expect(env.API_PREFIX).toBe('v1');
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('parte la lista de orígenes y descarta vacíos', () => {
    const env = validateEnv({ ...base, CORS_ORIGINS: 'http://a.co, http://b.co,' });

    expect(env.CORS_ORIGINS).toEqual(['http://a.co', 'http://b.co']);
  });

  it('falla al arrancar si falta la conexión a Mongo', () => {
    expect(() => validateEnv({})).toThrow('MONGODB_URI');
  });
});
