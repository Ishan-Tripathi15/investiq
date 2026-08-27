function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required production environment variable: ${name}`);
  return value;
}

export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = required('AUTH_JWT_SECRET');
  const encryptionKey = required('DATA_ENCRYPTION_KEY');
  required('DATABASE_URL');
  required('REDIS_URL');

  if (jwtSecret.length < 32) {
    throw new Error('AUTH_JWT_SECRET must be at least 32 characters in production');
  }
  if (encryptionKey.length < 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be at least 32 characters in production');
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port in production');
  }
}
