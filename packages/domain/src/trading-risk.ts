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
  maxPositionConcentrationPct: number;
  maxPortfolioExposurePct: number;
  maxPriceDeviationPct: number;
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
  const existingPosition = context.positions.find((position) => position.symbol.trim().toUpperCase() === normalizedSymbol);
  const trustedReferencePrice = existingPosition?.currentPrice && existingPosition.currentPrice > 0 ? existingPosition.currentPrice : undefined;
  const estimatedPrice = price && price > 0 ? price : trustedReferencePrice;
  const estimatedNotional = estimatedPrice && estimatedPrice > 0 ? request.quantity * estimatedPrice : undefined;
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

  const positionQuantity = existingPosition?.quantity ?? 0;
  const sellQuantityOk = request.side !== 'sell' || request.quantity <= positionQuantity;
  checks.push({
    code: 'position_quantity',
    passed: sellQuantityOk,
    message: sellQuantityOk ? 'Sell quantity is supported by the current position.' : `Sell quantity exceeds the current position of ${positionQuantity}.`,
  });

  const equity = context.account.totalEquity;
  const currentSymbolValue = existingPosition?.marketValue ?? 0;
  const projectedSymbolValue = request.side === 'buy'
    ? currentSymbolValue + (estimatedNotional ?? 0)
    : Math.max(0, currentSymbolValue - (estimatedNotional ?? 0));
  const concentrationPct = equity && equity > 0 && estimatedNotional !== undefined ? (projectedSymbolValue / equity) * 100 : undefined;
  const concentrationOk = concentrationPct === undefined || concentrationPct <= context.maxPositionConcentrationPct;
  checks.push({
    code: 'position_concentration',
    passed: concentrationOk,
    message: concentrationOk
      ? 'Projected position concentration is within the configured limit.'
      : `Projected position concentration of ${concentrationPct?.toFixed(2)}% exceeds the maximum of ${context.maxPositionConcentrationPct}%.`,
  });

  const currentExposure = context.positions.reduce((sum, position) => sum + Math.max(0, position.marketValue), 0);
  const projectedExposure = request.side === 'buy'
    ? currentExposure + (estimatedNotional ?? 0)
    : Math.max(0, currentExposure - (estimatedNotional ?? 0));
  const exposurePct = equity && equity > 0 && estimatedNotional !== undefined ? (projectedExposure / equity) * 100 : undefined;
  const exposureOk = exposurePct === undefined || exposurePct <= context.maxPortfolioExposurePct;
  checks.push({
    code: 'portfolio_exposure',
    passed: exposureOk,
    message: exposureOk
      ? 'Projected portfolio exposure is within the configured limit.'
      : `Projected portfolio exposure of ${exposurePct?.toFixed(2)}% exceeds the maximum of ${context.maxPortfolioExposurePct}%.`,
  });

  const deviationPct = price && trustedReferencePrice ? Math.abs((price - trustedReferencePrice) / trustedReferencePrice) * 100 : undefined;
  const priceDeviationOk = deviationPct === undefined || deviationPct <= context.maxPriceDeviationPct;
  checks.push({
    code: 'price_deviation',
    passed: priceDeviationOk,
    message: priceDeviationOk
      ? 'Order price is within the configured deviation limit.'
      : `Order price deviates ${deviationPct?.toFixed(2)}% from the trusted reference price, exceeding the maximum of ${context.maxPriceDeviationPct}%.`,
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
