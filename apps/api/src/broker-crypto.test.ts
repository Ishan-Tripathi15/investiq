import { describe, expect, it } from 'vitest';
import { decryptBrokerToken, encryptBrokerToken, hashBrokerOAuthState } from './broker-crypto';

describe('broker crypto', () => {
  it('encrypts and decrypts broker access tokens', () => {
    process.env.BROKER_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const token = 'sensitive-access-token';
    const encrypted = encryptBrokerToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptBrokerToken(encrypted)).toBe(token);
  });

  it('hashes OAuth state deterministically', () => {
    expect(hashBrokerOAuthState('state-123')).toBe(hashBrokerOAuthState('state-123'));
    expect(hashBrokerOAuthState('state-123')).not.toBe(hashBrokerOAuthState('state-456'));
  });
});
