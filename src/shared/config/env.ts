import { z } from 'zod';

/**
 * Contrato de variables de entorno.
 *
 * Se valida UNA vez, al arrancar, y el proceso muere si falta algo. Leer
 * `process.env.X` donde haga falta convierte un error de configuración en un
 * fallo intermitente en producción, en la única ruta que nadie probó.
 *
 * Los secretos que vengan (JWT, Wompi, WhatsApp) NO llevan valor por defecto:
 * un default es la forma clásica de terminar en producción con `change-me`.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3100),

  /** Prefijo de todas las rutas HTTP. Versionar desde el día 1 sale gratis; añadirlo después, no. */
  API_PREFIX: z.string().min(1).default('v1'),

  /**
   * Debe apuntar a un replica set (`?replicaSet=` o Atlas): las transacciones
   * y los change streams no existen en un Mongo suelto.
   */
  MONGODB_URI: z.string().startsWith('mongodb'),

  /**
   * Firma los tokens del equipo. 32 caracteres es el mínimo razonable para
   * HS256. Sin valor por defecto: un default termina firmando producción.
   */
  JWT_SECRET: z.string().min(32),
  /** Cuánto dura la sesión de alguien del equipo: un turno. */
  JWT_TTL: z.string().min(1).default('12h'),

  /**
   * Orígenes permitidos, separados por coma. Se normaliza a array acá para que
   * ningún módulo tenga que volver a partir el string.
   */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Variables de entorno inválidas:\n${problems}`);
  }

  return parsed.data;
}
