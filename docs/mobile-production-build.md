# Mobile production build

## Required values
- EXPO_PUBLIC_API_URL
- EXPO_PUBLIC_EAS_PROJECT_ID

Set real values in EAS after the production API URL and EAS project are known.

## Before building
- Confirm API HTTPS and `/api/v1/health`.
- Confirm push notification configuration in EAS.
- Confirm iOS signing and Android keystore are configured through EAS.
- Run release-candidate E2E/smoke tests.

## Build
- `eas build --platform android --profile production`
- `eas build --platform ios --profile production`

Never commit signing certificates, keystores, App Store Connect keys, or other credentials.
