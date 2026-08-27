#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('SMOKE_BASE_URL is required, e.g. https://api.example.com');
  process.exit(2);
}

const checks = [
  ['/api/v1/health', 200],
  ['/api/v1/trading/status', 200],
  ['/api/v1/market-data/status', 200],
];

let failed = false;

for (const [path, expected] of checks) {
  const url = baseUrl + path;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = await response.text();
    const ok = response.status === expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${response.status} ${path}`);
    if (!ok) {
      console.error(body.slice(0, 500));
      failed = true;
    }
  } catch (error) {
    console.error(`FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Production smoke checks passed.');
