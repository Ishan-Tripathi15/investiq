import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY='investiq.access_token';
const REFRESH_KEY='investiq.refresh_token';
const DEVICE_KEY='investiq.device_id';

export async function getOrCreateDeviceId(): Promise<string>{
  const existing=await SecureStore.getItemAsync(DEVICE_KEY,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
  if(existing)return existing;
  const created=Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY,created,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
  return created;
}

export async function saveSession(accessToken:string,refreshToken:string){await SecureStore.setItemAsync(ACCESS_KEY,accessToken,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});await SecureStore.setItemAsync(REFRESH_KEY,refreshToken,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
export async function getAccessToken(){return SecureStore.getItemAsync(ACCESS_KEY);}
export async function getRefreshToken(){return SecureStore.getItemAsync(REFRESH_KEY);}
export async function clearSession(){await SecureStore.deleteItemAsync(ACCESS_KEY);await SecureStore.deleteItemAsync(REFRESH_KEY);}
