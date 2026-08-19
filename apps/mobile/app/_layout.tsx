import { useEffect, useState } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, View } from 'react-native';
import { getAccessToken } from '@/auth';
import { requireBiometricUnlock } from '@/biometrics';
import { registerForSecurityPushNotifications } from '@/notifications';

const PUBLIC_ROUTES = new Set(['/login']);
let biometricSessionUnlocked = false;
let pushRegistrationAttempted = false;

export default function RootLayout() {
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);

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
      if (!pushRegistrationAttempted) {
        pushRegistrationAttempted = true;
        try { await registerForSecurityPushNotifications(); } catch { /* Push setup is optional until production credentials are configured. */ }
      }
    }
    void guard();
    return () => { cancelled = true; };
  }, [pathname]);

  return (
    <>
      <StatusBar style="light" />
      {locked ? <View /> : <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />}
    </>
  );
}
