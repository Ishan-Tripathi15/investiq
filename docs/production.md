# InvestIQ production configuration

## API
The API is packaged as a production Node 20 container at `apps/api/Dockerfile`.
Configure production secrets in the hosting provider, never in Git:
- DATABASE_URL
- REDIS_URL
- AUTH_JWT_SECRET (at least 32 random characters)
- DATA_ENCRYPTION_KEY (at least 32 random characters)
- TWELVE_DATA_API_KEY
- Broker/notification secrets only when those integrations are enabled

Health check: `GET /api/v1/health`

## Mobile
Only these public variables belong in the mobile build:
- EXPO_PUBLIC_API_URL
- EXPO_PUBLIC_EAS_PROJECT_ID

Configure them through the EAS production environment. Never put JWT, database, encryption, broker, or provider secrets in the mobile app.

## Release checklist
1. Provision PostgreSQL and Redis.
2. Configure API production secrets.
3. Deploy the API container.
4. Confirm `/api/v1/health` is healthy.
5. Configure EAS production variables.
6. Build iOS/Android production artifacts.
7. Run the existing E2E suite against staging/production before store release.
