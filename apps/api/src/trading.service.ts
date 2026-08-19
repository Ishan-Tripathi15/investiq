import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createDraftOrder, type OrderRequest, validateOrder, validateOrderCapabilities } from '@investiq/domain';
import { createBrokerAdapter } from './trading.provider';
import { TradingRepository } from './trading.repository';
import { TradingRiskService } from './trading-risk.service';
import { BrokerConnectionRepository } from './broker-connection.repository';
import { TransactionAuthorizationService } from './transaction-authorization.service';
import type { BrokerAdapter } from './trading.types';

@Injectable()
export class TradingService {
  private readonly broker: BrokerAdapter;
  constructor(
    private readonly repository: TradingRepository,
    private readonly risk: TradingRiskService,
    private readonly connections: BrokerConnectionRepository,
    private readonly transactionAuthorization: TransactionAuthorizationService,
  ) {
    this.broker = createBrokerAdapter(connections);
  }

  async status() { return this.broker.health(); }
  async capabilities() { return this.broker.capabilities(); }
  async quote(symbol: string) { const normalized = symbol.trim().toUpperCase(); if (!normalized) throw new BadRequestException('Symbol is required'); return this.broker.quote(normalized); }

  private async capabilityCheck(request: OrderRequest) {
    const capabilities = await this.broker.capabilities();
    if (!capabilities) return { capabilities: null, supported: false, checks: [{ code: 'broker_capabilities', passed: false, message: 'Broker capabilities are unavailable.' }] };
    return { capabilities, ...validateOrderCapabilities(request, capabilities) };
  }

  async preview(userId: string, request: OrderRequest) {
    const errors = validateOrder(request);
    if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });
    const estimatedValue = (request.price ?? 0) * request.quantity;
    const health = await this.broker.health(userId);
    const capabilities = await this.capabilityCheck(request);
    const risk = health.configured && health.connected && capabilities.supported ? await this.risk.evaluate(userId, request) : { decision: 'unavailable' as const, checks: [], message: !capabilities.supported ? 'Broker capability checks did not approve this order.' : health.message };
    void this.repository.audit(userId, 'order.previewed', { request, capabilities, risk });
    return { valid: true, request, estimatedValue: request.type === 'market' ? undefined : estimatedValue, execution: 'broker_required', transaction_authorization: 'required', capabilities, risk,
      message: !capabilities.supported ? 'Order is not compatible with the configured broker capabilities.' : risk.decision === 'rejected' ? 'Order failed the pre-trade risk checks.' : 'Order validated locally. A one-time MFA transaction authorization is required before live execution.' };
  }

  async placeOrder(userId: string, request: OrderRequest, idempotencyKey?: string, transactionAuthorization?: string) {
    const errors = validateOrder(request); if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });
    const key = idempotencyKey?.trim(); const orderId = randomUUID();
    if (key) {
      const existing = await this.repository.beginExecution(userId, key, request, orderId);
      if (existing?.userId && existing.userId !== userId) throw new ConflictException('Idempotency key belongs to another user');
      if (existing?.status === 'completed' && existing.response) return existing.response;
      if (existing?.status === 'processing') throw new ConflictException('An order with this idempotency key is already being processed');
      if (existing?.status === 'failed') throw new ConflictException(existing.errorMessage ?? 'An order with this idempotency key already failed');
      void this.repository.audit(userId, 'order.execution_requested', { request }, orderId, key);
    } else void this.repository.audit(userId, 'order.execution_requested', { request }, orderId);

    const health = await this.broker.health(userId);
    if (!health.configured || !health.connected) {
      if (key) await this.repository.failExecution(key, health.message);
      void this.repository.audit(userId, 'order.execution_unavailable', { request, reason: health.message }, orderId, key);
      throw new ServiceUnavailableException(health.message);
    }
    const capabilities = await this.capabilityCheck(request);
    if (!capabilities.supported) {
      const reason = capabilities.checks.filter((check) => !check.passed).map((check) => check.message).join(' ');
      if (key) await this.repository.failExecution(key, reason);
      void this.repository.audit(userId, 'order.execution_failed', { request, capabilities }, orderId, key);
      throw new BadRequestException({ message: 'Broker capability validation failed', checks: capabilities.checks });
    }
    const risk = await this.risk.evaluate(userId, request);
    if (risk.decision !== 'approved') {
      const reason = risk.message ?? 'Pre-trade risk checks did not approve this order';
      if (key) await this.repository.failExecution(key, reason);
      void this.repository.audit(userId, 'order.risk_rejected', { request, risk }, orderId, key);
      throw new BadRequestException({ message: reason, risk });
    }
    await this.transactionAuthorization.consume(userId, transactionAuthorization, request);
    void this.repository.audit(userId, 'order.transaction_authorized', { authorization: 'one_time_mfa', request }, orderId, key);
    void this.repository.audit(userId, 'order.risk_approved', { request, risk }, orderId, key);
    try {
      const order = await this.broker.placeOrder(userId, request);
      if (key) await this.repository.completeExecution(key, order);
      void this.repository.audit(userId, 'order.execution_succeeded', { broker: health.broker, order }, order.id, key);
      return order;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Broker execution failed';
      if (key) await this.repository.failExecution(key, message);
      void this.repository.audit(userId, 'order.execution_failed', { broker: health.broker, message }, orderId, key);
      throw error;
    }
  }

  async cancelOrder(userId: string, orderId: string) { const health = await this.broker.health(userId); if (!health.configured || !health.connected) throw new ServiceUnavailableException(health.message); const order = await this.broker.cancelOrder(userId, orderId); void this.repository.audit(userId, 'order.cancelled', { order }, orderId); return order; }
  async getOrder(userId: string, orderId: string) { return this.broker.getOrder(userId, orderId); }
  async listOrders(userId: string) { return this.broker.listOrders(userId); }
  async positions(userId: string) { return this.broker.getPositions(userId); }
  async account(userId: string) { return this.broker.getAccount(userId); }
  draftForAudit(request: OrderRequest, id: string) { return createDraftOrder(request, id); }
}
