export type RiskDecision = 'approved' | 'rejected' | 'unavailable';

export interface RiskAccount {
  availableCash?: number;
  totalEquity?: number;
  currency: string;
}

export interface RiskPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedValue: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface RiskOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: string;
  filledQuantity: number;
}

export interface PreTradeRiskContext {
  account: RiskAccount;
  positions: RiskPosition[];
  recentOrders: RiskOrder[];
  maxOrderQuantity: number;
  maxOrderNotional: number;
  maxOpenOrdersPerSymbol: number;
  requirePriceForBuyingPowerCheck: boolean;
}

export interface PreTradeRiskResult {
  decision: RiskDecision;
  checks: Array<{ code: string; passed: boolean; message: string }>;
  estimatedNotional?: number;
  availableBuyingPower?: number;
}

export function evaluatePreTradeRisk(request: {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop_loss' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
}, context: PreTradeRiskContext): PreTradeRiskResult {
  const checks: Array<{ code: string; passed: boolean; message: string }> = [];
  const normalizedSymbol = request.symbol.trim().toUpperCase();

  const quantityOk = Number.isFinite(request.quantity) && request.quantity > 0 && request.quantity <= context.maxOrderQuantity;
  checks.push({
    code: 'quantity_limit',
    passed: quantityOk,
    message: quantityOk ? 'Order quantity is within the configured risk limit.' : `Order quantity exceeds the maximum allowed quantity of ${context.maxOrderQuantity}.`,
  });

  const price = request.price ?? request.stopPrice;
  const estimatedNotional = price && price > 0 ? request.quantity * price : undefined;
  const notionalOk = estimatedNotional === undefined || estimatedNotional <= context.maxOrderNotional;
  checks.push({
    code: 'notional_limit',
    passed: notionalOk,
    message: notionalOk ? 'Estimated order notional is within the configured risk limit.' : `Estimated order notional exceeds the maximum allowed notional of ${context.maxOrderNotional}.`,
  });

  const openOrders = context.recentOrders.filter((order) =>
    order.symbol.trim().toUpperCase() === normalizedSymbol &&
    ['draft', 'pending', 'submitted', 'partially_filled'].includes(order.status),
  );
  const openOrderOk = openOrders.length < context.maxOpenOrdersPerSymbol;
  checks.push({
    code: 'open_order_limit',
    passed: openOrderOk,
    message: openOrderOk ? 'Open-order count is within the configured limit.' : `Too many open orders already exist for ${normalizedSymbol}.`,
  });

  const duplicate = openOrders.some((order) =>
    order.side === request.side &&
    order.type === request.type &&
    order.quantity === request.quantity &&
    (order.price ?? undefined) === (request.price ?? undefined) &&
    (order.stopPrice ?? undefined) === (request.stopPrice ?? undefined),
  );
  checks.push({
    code: 'duplicate_order',
    passed: !duplicate,
    message: duplicate ? 'A matching open order already exists.' : 'No matching open order was detected.',
  });

  let buyingPowerOk = true;
  let buyingPowerMessage = 'Buying-power check is not required for this order.';
  if (request.side === 'buy') {
    if (estimatedNotional === undefined && context.requirePriceForBuyingPowerCheck) {
      buyingPowerOk = false;
      buyingPowerMessage = 'Buying power cannot be verified without a trusted broker price for this market order.';
    } else if (estimatedNotional !== undefined && context.account.availableCash !== undefined) {
      buyingPowerOk = estimatedNotional <= context.account.availableCash;
      buyingPowerMessage = buyingPowerOk
        ? 'Estimated order value is within available cash.'
        : 'Estimated order value exceeds available cash.';
    } else {
      buyingPowerMessage = 'Buying power is unavailable from the broker account snapshot.';
    }
  }
  checks.push({ code: 'buying_power', passed: buyingPowerOk, message: buyingPowerMessage });

  const rejected = checks.filter((check) => !check.passed);
  return {
    decision: rejected.length ? 'rejected' : 'approved',
    checks,
    ...(estimatedNotional !== undefined ? { estimatedNotional } : {}),
    ...(context.account.availableCash !== undefined ? { availableBuyingPower: context.account.availableCash } : {}),
  };
}
