import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { NetworkTelephonyModule } = NativeModules;

export interface CellularInfo {
  isAvailable: boolean;
  operator: string;
  simOperator: string;
  countryIso: string;
  generation: '2g' | '3g' | '4g' | '5g' | 'unknown';
  technology: string;
  rawNetworkType: number;
  /** Nivel de señal en decibelios-milivatio (ej. -85 dBm). Null si no está conectado a red celular. */
  signalDbm: number | null;
  /** Nivel discreto de señal de 0 (sin señal) a 4 (excelente). */
  signalLevel: number;
  /** Arbitrary Strength Unit (ASU). */
  asuLevel: number;
  timestamp: number;
  reason?: string;
}

const defaultCellularInfo: CellularInfo = {
  isAvailable: false,
  operator: 'Sin red celular',
  simOperator: '',
  countryIso: '',
  generation: 'unknown',
  technology: 'Desconocido',
  rawNetworkType: 0,
  signalDbm: null,
  signalLevel: 0,
  asuLevel: 0,
  timestamp: 0,
};

let eventEmitter: NativeEventEmitter | null = null;
if (Platform.OS === 'android' && NetworkTelephonyModule) {
  eventEmitter = new NativeEventEmitter(NetworkTelephonyModule);
}

/**
 * Consulta manual del estado actual de la red celular a través del TelephonyManager.
 */
export async function getCellularInfo(): Promise<CellularInfo> {
  if (Platform.OS !== 'android' || !NetworkTelephonyModule) {
    return defaultCellularInfo;
  }
  try {
    const data = await NetworkTelephonyModule.getCellularInfo();
    return {
      ...defaultCellularInfo,
      ...data,
      timestamp: data.timestamp || Date.now(),
    };
  } catch (err) {
    console.warn('[TelephonyModule] Error al obtener info celular:', err);
    return defaultCellularInfo;
  }
}

/**
 * Inicia la escucha reactiva de cambios de señal celular y operador.
 * Devuelve la función para cancelar la suscripción.
 */
export function startCellularMonitoring(onChange: (info: CellularInfo) => void): () => void {
  if (Platform.OS !== 'android' || !NetworkTelephonyModule || !eventEmitter) {
    return () => {};
  }

  try {
    NetworkTelephonyModule.startListening();
  } catch (err) {
    console.warn('[TelephonyModule] startListening falló:', err);
  }

  // Consulta inicial inmediata
  getCellularInfo().then(onChange).catch(() => {});

  const subscription = eventEmitter.addListener('onCellInfoChanged', (data: Partial<CellularInfo>) => {
    onChange({
      ...defaultCellularInfo,
      ...data,
      timestamp: data.timestamp || Date.now(),
    });
  });

  return () => {
    subscription.remove();
    try {
      NetworkTelephonyModule.stopListening();
    } catch {}
  };
}
