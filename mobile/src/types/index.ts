/** Tipos de dominio compartidos por toda la app. */

export type ConnectionKind = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown' | 'other';

/** Generación celular normalizada (NetInfo reporta "2g" | "3g" | "4g" | "5g"). */
export type CellularGeneration = '2g' | '3g' | '4g' | '5g' | null;

export interface NetworkSnapshot {
  kind: ConnectionKind;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  /** Solo si kind === 'cellular'. */
  cellularGeneration: CellularGeneration;
  /** Nombre del operador (NetInfo; luego se refina con el módulo nativo de Fase 3). */
  carrier: string | null;
  /** Solo si kind === 'wifi'. */
  wifiSsid: string | null;
  wifiStrength: number | null;
  updatedAt: number;
}

export type PermissionKey = 'location' | 'backgroundLocation' | 'phoneState' | 'notifications';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'unknown';

export type PermissionMap = Record<PermissionKey, PermissionStatus>;
