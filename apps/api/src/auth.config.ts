export interface AuthConfig {
  jwksUrl: string;
  issuer: string;
  audience: string;
  clockToleranceSeconds: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for authentication`);
  return value;
}

export function getAuthConfig(): AuthConfig {
  const jwksUrl = required('AUTH_JWKS_URL');
  const issuer = required('AUTH_ISSUER');
  const audience = required('AUTH_AUDIENCE');
  const clockToleranceSeconds = Number(process.env.AUTH_CLOCK_TOLERANCE_SECONDS ?? '5');

  if (!Number.isFinite(clockToleranceSeconds) || clockToleranceSeconds < 0 || clockToleranceSeconds > 300) {
    throw new Error('AUTH_CLOCK_TOLERANCE_SECONDS must be between 0 and 300');
  }

  try {
    new URL(jwksUrl);
  } catch {
    throw new Error('AUTH_JWKS_URL must be a valid URL');
  }

  return { jwksUrl, issuer, audience, clockToleranceSeconds };
}
