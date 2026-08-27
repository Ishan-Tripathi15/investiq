# Production smoke testing

Run this only against a deployed staging/release-candidate or production API.

## GitHub Actions
Open **Actions → Production Smoke Test → Run workflow** and enter the deployed API base URL, for example `https://api.example.com`.

The smoke suite verifies:
- `GET /api/v1/health`
- `GET /api/v1/trading/status`
- `GET /api/v1/market-data/status`

These checks do not place orders or mutate user data.

## Release-candidate manual checks
After the public endpoints pass, validate with a test account:
1. Sign in / refresh session.
2. Load market data.
3. Load news and mutual-fund data.
4. Load portfolio/watchlist.
5. Verify paper-trading/order preview flows.
6. Verify notification registration.
7. Verify biometric unlock on a physical device.

Do not use a real-money account for automated smoke tests.
