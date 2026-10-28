import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import type { PermissionKey, PermissionMap, PermissionStatus } from '../../types';

/**
 * Solicitud de permisos en tiempo de ejecución.
 *
 * Android: PermissionsAndroid. La ubicación en background DEBE pedirse
 * después de la ubicación en primer plano (Android 11+ lo exige).
 *
 * iOS: la ubicación la solicita la librería de geolocalización (Fase 5) y las
 * notificaciones Notifee (Fase 7); aquí se reportan como 'unknown'.
 */

const P = PermissionsAndroid.PERMISSIONS;
const apiLevel = Platform.OS === 'android' ? Number(Platform.Version) : 0;

const ANDROID_PERMISSIONS: Record<PermissionKey, Permission | null> = {
  location: P.ACCESS_FINE_LOCATION,
  // Disponible desde API 29 (Android 10).
  backgroundLocation: apiLevel >= 29 ? P.ACCESS_BACKGROUND_LOCATION : null,
  phoneState: P.READ_PHONE_STATE,
  // Permiso en runtime desde API 33 (Android 13).
  notifications: apiLevel >= 33 ? P.POST_NOTIFICATIONS : null,
};

function mapResult(result: string): PermissionStatus {
  switch (result) {
    case PermissionsAndroid.RESULTS.GRANTED:
      return 'granted';
    case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
      return 'blocked';
    default:
      return 'denied';
  }
}

export async function checkPermission(key: PermissionKey): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'unknown';
  const perm = ANDROID_PERMISSIONS[key];
  // Permiso inexistente en esta versión => se considera concedido implícitamente.
  if (!perm) return 'granted';
  return (await PermissionsAndroid.check(perm)) ? 'granted' : 'denied';
}

export async function requestPermission(key: PermissionKey): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'unknown';
  const perm = ANDROID_PERMISSIONS[key];
  if (!perm) return 'granted';

  if (key === 'backgroundLocation') {
    const fg = await checkPermission('location');
    if (fg !== 'granted') return 'denied';
  }
  return mapResult(await PermissionsAndroid.request(perm));
}

export async function checkAllPermissions(): Promise<PermissionMap> {
  const keys: PermissionKey[] = ['location', 'backgroundLocation', 'phoneState', 'notifications'];
  const entries = await Promise.all(keys.map(async k => [k, await checkPermission(k)] as const));
  return Object.fromEntries(entries) as PermissionMap;
}
