import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

export class LocationService {
  /**
   * Solicita o verifica permisos de ubicación en tiempo de ejecución.
   */
  static async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permiso de Ubicación QoS',
          message:
            'QoS Monitor necesita acceso a su ubicación para georreferenciar las métricas de red en el mapa de cobertura.',
          buttonPositive: 'Aceptar',
          buttonNegative: 'Cancelar',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  }

  /**
   * Obtiene la posición GPS actual del dispositivo con alta precisión y timeout de seguridad.
   */
  static async getCurrentLocation(): Promise<LocationCoordinates | null> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) {
      console.warn('[LocationService] Permiso de ubicación no concedido.');
      return null;
    }

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.warn('[LocationService] Error obteniendo GPS:', error.message);
          // Si falla alta precisión, intentar con precisión estándar (red/wifi)
          Geolocation.getCurrentPosition(
            (fallbackPos) => {
              resolve({
                latitude: fallbackPos.coords.latitude,
                longitude: fallbackPos.coords.longitude,
                altitude: fallbackPos.coords.altitude,
                accuracy: fallbackPos.coords.accuracy,
                timestamp: fallbackPos.timestamp,
              });
            },
            (fallbackErr) => {
              console.warn('[LocationService] Fallback GPS también falló:', fallbackErr.message);
              resolve(null);
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 60000,
            },
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10000,
          forceRequestLocation: true,
          showLocationDialog: true,
        },
      );
    });
  }
}
