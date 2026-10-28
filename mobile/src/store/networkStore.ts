import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';
import type { CellularGeneration, ConnectionKind, NetworkSnapshot } from '../types';
import {
  type CellularInfo,
  startCellularMonitoring,
} from '../core/native/TelephonyModule';

interface NetworkStore {
  network: NetworkSnapshot;
  cellular: CellularInfo | null;
  /** Historial corto de cambios de red, útil para detectar conmutaciones Wi-Fi ↔ datos. */
  transitions: Array<{ from: ConnectionKind; to: ConnectionKind; at: number }>;
}

const initial: NetworkSnapshot = {
  kind: 'unknown',
  isConnected: false,
  isInternetReachable: null,
  cellularGeneration: null,
  carrier: null,
  wifiSsid: null,
  wifiStrength: null,
  updatedAt: 0,
};

export const useNetworkStore = create<NetworkStore>(() => ({
  network: initial,
  cellular: null,
  transitions: [],
}));

function toSnapshot(state: NetInfoState): NetworkSnapshot {
  const kind = (['wifi', 'cellular', 'ethernet', 'none', 'unknown'].includes(state.type)
    ? state.type
    : 'other') as ConnectionKind;

  const snapshot: NetworkSnapshot = {
    ...initial,
    kind,
    isConnected: !!state.isConnected,
    isInternetReachable: state.isInternetReachable,
    updatedAt: Date.now(),
  };

  if (state.type === 'cellular') {
    snapshot.cellularGeneration = (state.details.cellularGeneration ?? null) as CellularGeneration;
    snapshot.carrier = state.details.carrier ?? null;
  } else if (state.type === 'wifi') {
    snapshot.wifiSsid = state.details.ssid ?? null;
    snapshot.wifiStrength = state.details.strength ?? null;
  }
  return snapshot;
}

const MAX_TRANSITIONS = 50;

/**
 * Suscribe el store a NetInfo y al módulo nativo TelephonyManager.
 * Devuelve la función para cancelar ambas suscripciones.
 */
export function startNetworkMonitoring(): () => void {
  const unsubscribeNetInfo = NetInfo.addEventListener(state => {
    const next = toSnapshot(state);
    useNetworkStore.setState(prev => {
      const changed = prev.network.kind !== next.kind && prev.network.updatedAt !== 0;
      return {
        network: next,
        transitions: changed
          ? [{ from: prev.network.kind, to: next.kind, at: next.updatedAt }, ...prev.transitions].slice(
              0,
              MAX_TRANSITIONS,
            )
          : prev.transitions,
      };
    });
  });

  const unsubscribeCellular = startCellularMonitoring(cellularInfo => {
    useNetworkStore.setState({ cellular: cellularInfo });
  });

  return () => {
    unsubscribeNetInfo();
    unsubscribeCellular();
  };
}
