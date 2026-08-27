# InvestIQ release gate

This is the final gate before a public store release.

## Required external setup
The repository cannot create or verify third-party production accounts. Before release, configure:
- Production PostgreSQL and Redis
- API hosting and HTTPS domain
- Required API secrets in the hosting provider
- EAS project and credentials
- Apple Developer/App Store Connect configuration
- Google Play Console configuration
- Production push notification credentials
- Crash/error monitoring

## Release candidate
1. Deploy the API container.
2. Run the Production Smoke Test workflow against the deployed API.
3. Run the existing E2E suite against the release candidate.
4. Build Android and iOS with the EAS production profile.
5. Install both builds on physical test devices.
6. Verify sign-in/session refresh, market data, news, mutual funds, portfolio/watchlist, paper trading/order preview, notifications, and biometric unlock.
7. Confirm no test credentials, secrets, or placeholder API URLs are embedded in the release.
8. Obtain internal tester sign-off.

## Store release
- Android: submit the approved production build through EAS/Google Play.
- iOS: submit the approved production build through EAS/App Store Connect.

## Rollback
- Re-deploy the previous known-good API image.
- Pause/roll back the mobile store release using platform release controls.
- Preserve database encryption keys and migration compatibility.

## Important
A green GitHub CI result does not mean the app is already live. Actual deployment and store submission require external provider accounts and credentials.
