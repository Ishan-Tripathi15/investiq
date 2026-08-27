import { useEffect, useState } from 'react';
import { AppState, Alert, View } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getAccessToken } from '@/auth';
import { requireBiometricUnlock } from '@/biometrics';
import { registerForSecurityPushNotifications } from '@/notifications';

const PUBLIC_ROUTES = new Set(['/login']);
let biometricSessionUnlocked = false;
let pushRegistrationInFlight = false;

async function refreshPushRegistration() {
  if (pushRegistrationInFlight) return;
  const token = await getAccessToken();
  if (!token || !biometricSessionUnlocked) return;

  pushRegistrationInFlight = true;
  try {
    await registerForSecurityPushNotifications({ requestPermission: false });
  } catch {
    // Push registration is best-effort; the next foreground transition retries it.
  } finally {
    pushRegistrationInFlight = false;
  }
}

export default function RootLayout() {
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshPushRegistration();
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function guard() {
      if (PUBLIC_ROUTES.has(pathname) || biometricSessionUnlocked) return;

      const token = await getAccessToken();
      if (!token) return;

      const ok = await requireBiometricUnlock();
      if (cancelled) return;

      if (!ok) {
        setLocked(true);
        Alert.alert('InvestIQ locked', 'Biometric verification is required to continue.');
        router.replace('/login');
        return;
      }

      biometricSessionUnlocked = true;
      setLocked(false);
      void refreshPushRegistration();
    }

    void guard();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <>
      <StatusBar style="light" />
      {locked ? <View /> : <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />}
    </>
  );
}
