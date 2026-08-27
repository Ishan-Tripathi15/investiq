# InvestIQ launch readiness

## Before deployment
- [ ] PostgreSQL provisioned and migrations applied.
- [ ] Redis provisioned and reachable.
- [ ] Production API secrets configured in the server environment.
- [ ] Production API domain configured with HTTPS.
- [ ] `GET /api/v1/health` returns HTTP 200.
- [ ] Mobile `EXPO_PUBLIC_API_URL` points to the production API.
- [ ] EAS project ID configured.
- [ ] iOS and Android production builds complete successfully.
- [ ] E2E suite passes against the release candidate.
- [ ] Crash/error monitoring is enabled.
- [ ] Database backup/restore procedure is verified.
- [ ] Rate limiting and security headers are active.

## Release
1. Deploy the API container.
2. Verify the health endpoint.
3. Run smoke tests for authentication, market data, portfolio, trading/paper trading, mutual funds, news, and notifications.
4. Build the production iOS and Android artifacts with EAS.
5. Distribute the release candidate to internal testers.
6. Verify push notifications and biometric unlock on physical devices.
7. Promote the approved build to the stores.

## Rollback
- Keep the previous API container image available.
- Revert the mobile release only through the store/EAS release process.
- Do not rotate encryption keys during a routine rollback.
