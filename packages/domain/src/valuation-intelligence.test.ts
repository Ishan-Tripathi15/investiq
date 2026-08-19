import { strict as assert } from 'node:assert';
import test from 'node:test';
import { buildHistoricalValuation, summarizeValuation, valuationRegimes } from './valuation-intelligence';

test('buildHistoricalValuation calculates verified equity multiples', () => {
  const points = buildHistoricalValuation([
    { date: '2024-03-31', marketCap: 1000, earnings: 100, bookValue: 500, revenue: 2000, enterpriseValue: 1200, ebitda: 150 },
  ]);
  assert.equal(points[0].pe, 10);
  assert.equal(points[0].pb, 2);
  assert.equal(points[0].ps, 0.5);
  assert.equal(points[0].evToEbitda, 8);
});

test('buildHistoricalValuation never substitutes market cap for enterprise value', () => {
  const points = buildHistoricalValuation([
    { date: '2024-03-31', marketCap: 1000, earnings: 100, ebitda: 100 },
  ]);
  assert.equal(points[0].evToEbitda, undefined);
});

test('summarizeValuation reports historical percentile and regime', () => {
  const summary = summarizeValuation([
    { date: '2022-03-31', pe: 10 },
    { date: '2023-03-31', pe: 15 },
    { date: '2024-03-31', pe: 20 },
    { date: '2025-03-31', pe: 25 },
  ], 'pe');
  assert.equal(summary.current, 25);
  assert.equal(summary.median, 17.5);
  assert.equal(summary.percentile, 100);
  assert.equal(summary.status, 'expensive');
});

test('valuationRegimes returns all supported metrics and preserves unavailable states', () => {
  const regimes = valuationRegimes([{ date: '2025-03-31', pe: 12, ps: 2 }]);
  assert.equal(regimes.length, 4);
  assert.equal(regimes.find(item => item.metric === 'pe')?.observations, 1);
  assert.equal(regimes.find(item => item.metric === 'pb')?.status, 'unavailable');
  assert.equal(regimes.find(item => item.metric === 'evToEbitda')?.status, 'unavailable');
});
