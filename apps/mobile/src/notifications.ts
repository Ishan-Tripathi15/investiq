import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAccessToken, getOrCreateDeviceId } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForSecurityPushNotifications(): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return false;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const accessToken = await getAccessToken();
  if (!accessToken) return false;
  const deviceId = await getOrCreateDeviceId();
  const response = await fetch(`${API_URL}/security/notification-delivery/devices`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id: deviceId, platform: Platform.OS, provider: 'expo', pushToken: token.data }),
  });
  return response.ok;
}

export function subscribeToSecurityNotifications(onNotification: (notification: Notifications.Notification) => void) {
  const received = Notifications.addNotificationReceivedListener(onNotification);
  return () => received.remove();
}
