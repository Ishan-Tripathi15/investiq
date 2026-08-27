import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAccessToken, getOrCreateDeviceId } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const MAX_REGISTRATION_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 750, 1500];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function registerDevice(accessToken: string, deviceId: string, pushToken: string): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_REGISTRATION_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${API_URL}/security/notification-delivery/devices`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: deviceId,
          platform: Platform.OS,
          provider: 'expo',
          pushToken,
        }),
        signal: controller.signal,
      });

      if (response.ok) return true;

      // Retry only transient server failures. Auth/validation failures are not transient.
      if (response.status >= 400 && response.status < 500) return false;
    } catch {
      // Network errors and request timeouts are transient on mobile.
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_REGISTRATION_ATTEMPTS - 1) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  return false;
}

export async function registerForSecurityPushNotifications(
  options: { requestPermission?: boolean } = {},
): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;

  if (status !== 'granted' && options.requestPermission !== false) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  // Foreground recovery must never trigger another permission prompt.
  if (status !== 'granted') return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return false;

  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  const deviceId = await getOrCreateDeviceId();
  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return registerDevice(accessToken, deviceId, token.data);
}

export function subscribeToSecurityNotifications(
  onNotification: (notification: Notifications.Notification) => void,
) {
  const received = Notifications.addNotificationReceivedListener(onNotification);
  return () => received.remove();
}
