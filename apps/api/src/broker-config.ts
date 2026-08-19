export interface BrokerConfiguration {
  provider: string;
  configured: boolean;
}

/**
 * Resolves broker identity without ever exposing or returning credential values.
 * Secrets must stay in the server environment/secret manager and must never be
 * sent to the mobile client or persisted in the trading domain.
 */
export function resolveBrokerConfiguration(env: NodeJS.ProcessEnv = process.env): BrokerConfiguration {
  const provider = (env.BROKER_PROVIDER ?? '').trim().toLowerCase();
  return {
    provider: provider || 'unconfigured',
    configured: provider.length > 0,
  };
}
