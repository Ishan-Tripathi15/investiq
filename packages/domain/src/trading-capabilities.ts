import type { OrderRequest, OrderType, TimeInForce } from './trading';

export interface BrokerCapabilities {
  broker: string;
  exchange: string;
  currency: string;
  supportedOrderTypes: OrderType[];
  supportedTimeInForce: TimeInForce[];
  fractionalQuantity: boolean;
  minQuantity: number;
  maxQuantity: number;
  quantityStep: number;
  minPrice?: number;
  maxPrice?: number;
  priceTick: number;
  regularSessionOnly: boolean;
}

export interface CapabilityCheck {
  code: string;
  passed: boolean;
  message: string;
}

export interface CapabilityResult {
  supported: boolean;
  checks: CapabilityCheck[];
}

function isStepAligned(value: number, step: number): boolean {
  if (step <= 0) return true;
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

export function validateOrderCapabilities(request: OrderRequest, capabilities: BrokerCapabilities): CapabilityResult {
  const checks: CapabilityCheck[] = [];
  const typeSupported = capabilities.supportedOrderTypes.includes(request.type);
  checks.push({ code: 'order_type', passed: typeSupported, message: typeSupported ? 'Order type is supported by the broker.' : `Order type ${request.type} is not supported by this broker.` });

  const tif = request.timeInForce ?? 'day';
  const tifSupported = capabilities.supportedTimeInForce.includes(tif);
  checks.push({ code: 'time_in_force', passed: tifSupported, message: tifSupported ? 'Time-in-force is supported by the broker.' : `Time-in-force ${tif} is not supported by this broker.` });

  const quantity = Number.isFinite(request.quantity) && request.quantity >= capabilities.minQuantity && request.quantity <= capabilities.maxQuantity;
  const fractional = capabilities.fractionalQuantity || Number.isInteger(request.quantity);
  const step = isStepAligned(request.quantity, capabilities.quantityStep);
  checks.push({ code: 'quantity', passed: quantity && fractional && step, message: quantity && fractional && step ? 'Quantity satisfies broker constraints.' : 'Quantity violates broker minimum, maximum, fractional, or step constraints.' });

  const prices = [request.price, request.stopPrice].filter((value): value is number => value !== undefined);
  const priceRange = prices.every((value) => value > 0 && (capabilities.minPrice === undefined || value >= capabilities.minPrice) && (capabilities.maxPrice === undefined || value <= capabilities.maxPrice));
  const priceTick = prices.every((value) => isStepAligned(value, capabilities.priceTick));
  checks.push({ code: 'price_constraints', passed: priceRange && priceTick, message: priceRange && priceTick ? 'Prices satisfy broker price-band and tick constraints.' : 'One or more prices violate broker price-band or tick constraints.' });

  return { supported: checks.every((check) => check.passed), checks };
}
