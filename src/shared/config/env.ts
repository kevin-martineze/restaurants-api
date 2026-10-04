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
const baseSchema = z.object({
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
   * Dónde viven las fotos de la carta.
   *
   * `local` escribe en disco y la propia API las sirve bajo `/media`: sirve
   * para desarrollo y para un solo servidor. `s3` es cualquier almacenamiento
   * compatible (R2, S3, MinIO), que es lo que hace falta con varias instancias
   * o con un CDN delante.
   */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  MEDIA_DIR: z.string().min(1).default('media'),
  MEDIA_PUBLIC_URL: z
    .string()
    .url()
    .default('http://localhost:3100/media')
    .transform((value) => value.replace(/\/+$/, '')),
  /** Solo con `STORAGE_DRIVER=s3`. Sin `S3_ENDPOINT` se usa AWS con la región. */
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default('auto'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Base pública desde la que el navegador lee el bucket (dominio de R2, CDN…). */
  S3_PUBLIC_URL: z
    .string()
    .url()
    .optional()
    .transform((value) => value?.replace(/\/+$/, '')),
  /** MinIO y algunos S3 compatibles exigen el bucket en la ruta. */
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((value) => value === 'true' || value === '1'),

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

/** Con `s3`, sin bucket ni llaves la API no arranca: mejor ahora que al subir la primera foto. */
const envSchema = baseSchema.superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER !== 's3') return;

  const required: (keyof z.infer<typeof baseSchema>)[] = [
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_PUBLIC_URL',
  ];

  for (const key of required) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'Obligatoria con STORAGE_DRIVER=s3',
      });
    }
  }
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
