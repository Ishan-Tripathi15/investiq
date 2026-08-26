import { BadRequestException, Injectable } from '@nestjs/common';
import type { Order } from '@investiq/domain';

type OrderStatus = Order['status'];

const terminal = new Set<OrderStatus>(['filled', 'cancelled', 'rejected']);
const allowed: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending', 'cancelled', 'rejected'],
  pending: ['submitted', 'cancelled', 'rejected'],
  submitted: ['partially_filled', 'filled', 'cancelled', 'rejected'],
  partially_filled: ['partially_filled', 'filled', 'cancelled', 'rejected'],
  filled: [],
  cancelled: [],
  rejected: [],
};

@Injectable()
export class TradingStateService {
  assertTransition(from: OrderStatus, to: OrderStatus) {
    if (from === to && from === 'partially_filled') return;
    if (from === to) throw new BadRequestException(`Order state is already ${from}`);
    if (terminal.has(from)) throw new BadRequestException(`Order is already terminal: ${from}`);
    if (!allowed[from]?.includes(to)) throw new BadRequestException(`Invalid order transition: ${from} -> ${to}`);
  }

  transition(order: Order, to: OrderStatus): Order {
    this.assertTransition(order.status, to);
    return { ...order, status: to };
  }
}
