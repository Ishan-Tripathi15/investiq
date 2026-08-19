import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createDraftOrder, type OrderRequest, validateOrder } from '@investiq/domain';
import { createBrokerAdapter } from './trading.provider';
import type { BrokerAdapter } from './trading.types';

@Injectable()
export class TradingService {
  private readonly broker: BrokerAdapter;

  constructor() {
    this.broker = createBrokerAdapter();
  }

  async status() {
    return this.broker.health();
  }

  preview(request: OrderRequest) {
    const errors = validateOrder(request);
    if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });
    const estimatedValue = (request.price ?? 0) * request.quantity;
    return {
      valid: true,
      request,
      estimatedValue: request.type === 'market' ? undefined : estimatedValue,
      execution: 'broker_required',
      message: 'Order validated locally. Market orders require a live broker quote and all orders require a configured execution broker.',
    };
  }

  async placeOrder(request: OrderRequest) {
    const errors = validateOrder(request);
    if (errors.length) throw new BadRequestException({ message: 'Invalid order', errors });
    const health = await this.broker.health();
    if (!health.configured || !health.connected) throw new ServiceUnavailableException(health.message);
    return this.broker.placeOrder(request);
  }

  async cancelOrder(orderId: string) {
    const health = await this.broker.health();
    if (!health.configured || !health.connected) throw new ServiceUnavailableException(health.message);
    return this.broker.cancelOrder(orderId);
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
