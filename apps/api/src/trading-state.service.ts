import { BadRequestException, Injectable } from '@nestjs/common';
import { Order, OrderStatus } from './trading.types';

const TERMINAL: OrderStatus[] = ['filled', 'cancelled', 'rejected'];

@Injectable()
export class TradingStateService {
  assertTransition(from: OrderStatus, to: OrderStatus) {
    if (from === to) return;
    if (TERMINAL.includes(from)) throw new BadRequestException(`Order is already terminal: ${from}`);
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      draft: ['pending', 'cancelled', 'rejected'], pending: ['submitted', 'cancelled', 'rejected'], submitted: ['partially_filled', 'filled', 'cancelled', 'rejected'], partially_filled: ['partially_filled', 'filled', 'cancelled', 'rejected'], filled: [], cancelled: [], rejected: [],
    };
    if (!allowed[from].includes(to)) throw new BadRequestException(`Invalid order transition: ${from} -> ${to}`);
  }

  apply(order: Order, status: OrderStatus) {
    this.assertTransition(order.status, status);
    order.status = status;
    return order;
  }
}
