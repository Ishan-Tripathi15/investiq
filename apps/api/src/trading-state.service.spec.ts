import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TradingStateService } from './trading-state.service';

describe('TradingStateService', () => {
  const service = new TradingStateService();

  it('allows the canonical order lifecycle', () => {
    expect(() => service.assertTransition('draft', 'pending')).not.toThrow();
    expect(() => service.assertTransition('pending', 'submitted')).not.toThrow();
    expect(() => service.assertTransition('submitted', 'partially_filled')).not.toThrow();
    expect(() => service.assertTransition('partially_filled', 'filled')).not.toThrow();
  });

  it('allows cancellation before a terminal fill', () => {
    expect(() => service.assertTransition('draft', 'cancelled')).not.toThrow();
    expect(() => service.assertTransition('pending', 'cancelled')).not.toThrow();
    expect(() => service.assertTransition('submitted', 'cancelled')).not.toThrow();
    expect(() => service.assertTransition('partially_filled', 'cancelled')).not.toThrow();
  });

  it('rejects transitions out of terminal states', () => {
    for (const status of ['filled', 'cancelled', 'rejected'] as const) {
      expect(() => service.assertTransition(status, 'submitted')).toThrow(BadRequestException);
    }
  });

  it('rejects illegal transitions', () => {
    expect(() => service.assertTransition('draft', 'filled')).toThrow(BadRequestException);
    expect(() => service.assertTransition('pending', 'filled')).toThrow(BadRequestException);
    expect(() => service.assertTransition('submitted', 'draft')).toThrow(BadRequestException);
  });

  it('allows repeated partially-filled updates', () => {
    expect(() => service.assertTransition('partially_filled', 'partially_filled')).not.toThrow();
  });
});