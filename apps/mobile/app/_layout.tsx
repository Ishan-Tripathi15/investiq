import { useEffect, useState } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, View } from 'react-native';
import { getAccessToken } from '@/auth';
import { requireBiometricUnlock } from '@/biometrics';

const PUBLIC_ROUTES = new Set(['/login']);

export default function RootLayout() {
  const pathname = usePathname();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function guard() {
      if (PUBLIC_ROUTES.has(pathname)) return;
      const token = await getAccessToken();
      if (!token) return;
      const ok = await requireBiometricUnlock();
      if (cancelled) return;
      if (!ok) {
        setLocked(true);
        await Alert.alert('InvestIQ locked', 'Biometric verification is required to continue.');
        router.replace('/login');
        return;
      }
      setLocked(false);
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
