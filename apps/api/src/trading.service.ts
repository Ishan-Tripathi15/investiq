import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createDraftOrder, type OrderRequest, validateOrder } from '@investiq/domain';
import { createBrokerAdapter } from './trading.provider';
import { TradingRepository } from './trading.repository';
import { TradingRiskService } from './trading-risk.service';
import type { BrokerAdapter } from './trading.types';

@Injectable()
export class TradingService {
  private readonly broker: BrokerAdapter;

  constructor(
    private readonly repository: TradingRepository,
    private readonly risk: TradingRiskService,
  ) {
    this.broker = createBrokerAdapter();
  }

  async status() {
    return this.broker.health();
  }

  async preview(request: OrderRequest) {
    const errors = validateOrder(request);
    if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });
    const estimatedValue = (request.price ?? 0) * request.quantity;
    const health = await this.broker.health();
    const risk = health.configured && health.connected
      ? await this.risk.evaluate(request)
      : { decision: 'unavailable' as const, checks: [], message: health.message };
    void this.repository.audit('order.previewed', { request, risk });
    return {
      valid: true,
      request,
      estimatedValue: request.type === 'market' ? undefined : estimatedValue,
      execution: 'broker_required',
      risk,
      message: risk.decision === 'rejected'
        ? 'Order failed the pre-trade risk checks.'
        : 'Order validated locally. Execution requires a configured broker.',
    };
  }

  async placeOrder(request: OrderRequest, idempotencyKey?: string) {
    const errors = validateOrder(request);
    if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });

    const key = idempotencyKey?.trim();
    const orderId = randomUUID();
    if (key) {
      const existing = await this.repository.beginExecution(key, request, orderId);
      if (existing?.status === 'completed' && existing.response) return existing.response;
      if (existing?.status === 'processing') {
        throw new ConflictException('An order with this idempotency key is already being processed');
      }
      if (existing?.status === 'failed') {
        throw new ConflictException(existing.errorMessage ?? 'An order with this idempotency key already failed');
      }
      void this.repository.audit('order.execution_requested', { request }, orderId, key);
    } else {
      void this.repository.audit('order.execution_requested', { request }, orderId);
    }

    const health = await this.broker.health();
    if (!health.configured || !health.connected) {
      if (key) await this.repository.failExecution(key, health.message);
      void this.repository.audit('order.execution_unavailable', { request, reason: health.message }, orderId, key);
      throw new ServiceUnavailableException(health.message);
    }

    const risk = await this.risk.evaluate(request);
    void this.repository.audit('order.risk_approved', { request, risk }, orderId, key);

    try {
      const order = await this.broker.placeOrder(request);
      if (key) await this.repository.completeExecution(key, order);
      void this.repository.audit('order.execution_succeeded', { broker: health.broker, order }, order.id, key);
      return order;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Broker execution failed';
      if (key) await this.repository.failExecution(key, message);
      void this.repository.audit('order.execution_failed', { broker: health.broker, message }, orderId, key);
      throw error;
    }
  }

  async cancelOrder(orderId: string) {
    const health = await this.broker.health();
    if (!health.configured || !health.connected) throw new ServiceUnavailableException(health.message);
    const order = await this.broker.cancelOrder(orderId);
    void this.repository.audit('order.cancelled', { order }, orderId);
    return order;
  }

  async getOrder(orderId: string) {
    return this.broker.getOrder(orderId);
  }

  async listOrders() {
    return this.broker.listOrders();
  }

  async positions() {
    return this.broker.getPositions();
  }

  async account() {
    return this.broker.getAccount();
  }

  draftForAudit(request: OrderRequest, id: string) {
    return createDraftOrder(request, id);
  }
}
