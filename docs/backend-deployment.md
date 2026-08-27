# Backend deployment

This blueprint deploys the InvestIQ API as a Docker web service and exposes the existing health endpoint.

## Required secrets
Set these in the hosting provider, not Git:
- DATABASE_URL
- REDIS_URL
- AUTH_JWT_SECRET
- DATA_ENCRYPTION_KEY
- TWELVE_DATA_API_KEY

Optional broker/email/SMS secrets should only be configured when those integrations are enabled.

## Deployment
1. Connect the repository to your chosen deployment provider.
2. Apply the blueprint/configuration.
3. Enter the required secrets through the provider's secret manager.
4. Deploy the API.
5. Verify `GET /api/v1/health`.
6. Record the HTTPS API URL for the mobile EAS production environment.

## Important
The repository intentionally does not contain real credentials. The actual deployment cannot be completed from GitHub alone without access to the hosting account and production services.
