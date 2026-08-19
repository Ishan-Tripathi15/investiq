import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY = 'investiq.biometric_lock';

export async function biometricAvailability() {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return { hardware, enrolled };
}

export async function isBiometricLockEnabled() {
  return (await SecureStore.getItemAsync(KEY)) === '1';
}

export async function setBiometricLockEnabled(enabled: boolean) {
  if (enabled) {
    const available = await biometricAvailability();
    if (!available.hardware || !available.enrolled) throw new Error('A supported enrolled biometric is required');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable InvestIQ biometric protection',
      disableDeviceFallback: false,
    });
    if (!result.success) throw new Error('Biometric verification was not completed');
    await SecureStore.setItemAsync(KEY, '1', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return true;
  }
  await SecureStore.deleteItemAsync(KEY);
  return false;
}

export async function requireBiometricUnlock() {
  if (!(await isBiometricLockEnabled())) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock InvestIQ',
    disableDeviceFallback: false,
  });
  return result.success;
}
