export type SupportedExchange = 'NSE' | 'BSE';
export type SupportedCurrency = 'INR';

export interface BrokerCapabilities {
  broker: string;
  exchanges: SupportedExchange[];
  currencies: SupportedCurrency[];
  orderTypes: Array<'market' | 'limit' | 'stop_loss' | 'stop_limit'>;
  timeInForce: Array<'day' | 'gtc'>;
  quantity: { min: number; max: number; step: number; fractional: boolean };
  price: { min: number; max: number; tickSize: number };
}

export interface CapabilityDecision {
  allowed: boolean;
  errors: string[];
}

function aligned(value: number, step: number): boolean {
  if (step <= 0) return false;
  const quotient = value / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

export function evaluateBrokerCapabilities(
  order: { type: BrokerCapabilities['orderTypes'][number]; timeInForce?: BrokerCapabilities['timeInForce'][number]; quantity: number; price?: number },
  capabilities: BrokerCapabilities,
): CapabilityDecision {
  const errors: string[] = [];
  if (!capabilities.orderTypes.includes(order.type)) errors.push(`Order type ${order.type} is not supported by ${capabilities.broker}.`);
  const tif = order.timeInForce ?? 'day';
  if (!capabilities.timeInForce.includes(tif)) errors.push(`Time-in-force ${tif} is not supported by ${capabilities.broker}.`);
  if (!Number.isFinite(order.quantity) || order.quantity < capabilities.quantity.min || order.quantity > capabilities.quantity.max) errors.push('Order quantity is outside the broker-supported range.');
  if (!capabilities.quantity.fractional && !Number.isInteger(order.quantity)) errors.push('Fractional quantity is not supported by this broker.');
  if (!aligned(order.quantity, capabilities.quantity.step)) errors.push(`Order quantity must use a step of ${capabilities.quantity.step}.`);
  if (order.price !== undefined) {
    if (!Number.isFinite(order.price) || order.price < capabilities.price.min || order.price > capabilities.price.max) errors.push('Order price is outside the broker-supported price band.');
    if (!aligned(order.price, capabilities.price.tickSize)) errors.push(`Order price must align to tick size ${capabilities.price.tickSize}.`);
  }
  return { allowed: errors.length === 0, errors };
}
