import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLumpsumPlan, calculateReverseLumpsumPlan, calculateSipPlan } from './investment-lab';

test('investment lab: calculates a SIP with exact annual step-up contributions', () => {
  const plan = calculateSipPlan(10000, 12, 2, 10);
  assert.equal(plan.months, 24);
  assert.equal(plan.totalInvested, 252000);
  assert.equal(plan.yearly.length, 2);
  assert.equal(plan.yearly[0]?.invested, 120000);
  assert.equal(plan.yearly[1]?.invested, 252000);
  assert.ok(plan.finalValue > plan.totalInvested);
});

test('investment lab: calculates lumpsum scenarios', () => {
  const result = calculateLumpsumPlan(100000, 10, { conservative: 8, base: 12, optimistic: 15 });
  assert.ok(Math.abs((result[0]?.value ?? 0) - 108000) < 0.01);
  assert.ok(Math.abs((result[1]?.value ?? 0) - 112000) < 0.01);
  assert.ok(Math.abs((result[2]?.value ?? 0) - 115000) < 0.01);
});

test('investment lab: calculates reverse goal capital', () => {
  const result = calculateReverseLumpsumPlan(1000000, 5, { conservative: 8, base: 12, optimistic: 15 });
  assert.ok(Math.abs((result[1]?.value ?? 0) - 1000000 / Math.pow(1.12, 5)) < 0.01);
  assert.ok((result[0]?.value ?? 0) > (result[1]?.value ?? 0));
  assert.ok((result[1]?.value ?? 0) > (result[2]?.value ?? 0));
});
