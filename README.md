# InvestIQ

Production-grade investment intelligence platform for stocks, mutual funds, portfolio analytics, news, paper trading, and financial goal planning.

## Architecture

- `apps/mobile` — Expo React Native + TypeScript
- `apps/api` — NestJS API
- `packages/domain` — shared financial/domain contracts
- `packages/ui` — shared design system

## Product principles

- No fabricated market data
- Historical performance is distinct from projections
- Financial projections are scenarios, not guarantees
- Deterministic, testable calculations
- Secure-by-default services
- Premium, accessible, responsive UI
- Observability and CI from day one

## Development

The repository is being built incrementally as a production monorepo. Foundation first, then market data, Investment Lab, paper trading, portfolio/risk, mutual funds, news intelligence, AI, and broker integrations.