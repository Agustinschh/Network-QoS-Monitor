import { create } from 'zustand';
import {
  DEFAULT_PING_HOSTS,
  type PingHostConfig,
  type PingSuiteResult,
  runPingSuite,
} from '../core/engine/PingEngine';
import {
  DEFAULT_BACKEND_URL,
  type ThroughputProgress,
  type ThroughputResult,
  runFullThroughputSuite,
} from '../core/engine/ThroughputEngine';
import { LocationService, type LocationCoordinates } from '../core/geo/LocationService';
import { insertMeasurement } from '../database/db';
import { useNetworkStore } from './networkStore';

export type QoSTestStatus =
  | 'idle'
  | 'pinging'
  | 'downloading'
  | 'uploading'
  | 'locating'
  | 'completed'
  | 'error';

interface QoSStore {
  status: QoSTestStatus;
  statusMessage: string;
  backendUrl: string;
  hosts: PingHostConfig[];
  pingResult: PingSuiteResult | null;
  throughputResult: ThroughputResult | null;
  liveThroughput: ThroughputProgress | null;
  lastLocation: LocationCoordinates | null;
  lastSavedId: number | null;
  lastError: string | null;

  setBackendUrl: (url: string) => void;
  setHosts: (hosts: PingHostConfig[]) => void;
  runTest: () => Promise<void>;
  reset: () => void;
}

export const useQoSStore = create<QoSStore>((set, get) => ({
  status: 'idle',
  statusMessage: 'Listo para medir',
  backendUrl: DEFAULT_BACKEND_URL,
  hosts: DEFAULT_PING_HOSTS,
  pingResult: null,
  throughputResult: null,
  liveThroughput: null,
  lastLocation: null,
  lastSavedId: null,
  lastError: null,

  setBackendUrl: url => set({ backendUrl: url }),
  setHosts: hosts => set({ hosts }),

  reset: () =>
    set({
      status: 'idle',
      statusMessage: 'Listo para medir',
      liveThroughput: null,
      lastError: null,
    }),

  runTest: async () => {
    const { hosts, backendUrl, status } = get();
    if (
      status === 'pinging' ||
      status === 'downloading' ||
      status === 'uploading' ||
      status === 'locating'
    ) {
      return;
    }

    set({
      status: 'pinging',
      statusMessage: 'Iniciando sondas TCP de latencia (RTT / Jitter)...',
      lastError: null,
      liveThroughput: null,
    });

    try {
      // Paso 1: Pings contra los 3 hosts
      const pingResult = await runPingSuite(
        hosts,
        5,
        (hostName, probeIndex, total, currentRtt) => {
          set({
            statusMessage: `Sonda TCP [${hostName}] ${probeIndex}/${total}: ${
              currentRtt != null ? `${currentRtt} ms` : 'timeout'
            }`,
          });
        },
      );

      set({
        pingResult,
        status: 'downloading',
        statusMessage: 'Midiendo velocidad de bajada (Throughput)...',
      });

      // Paso 2: Throughput (Descarga + Subida)
      const throughputResult = await runFullThroughputSuite(
        backendUrl,
        3, // 3MB download
        0.5, // 0.5MB (512KB) upload
        progress => {
          set({
            liveThroughput: progress,
            status: progress.phase === 'upload' ? 'uploading' : 'downloading',
            statusMessage:
              progress.phase === 'download'
                ? `Descargando: ${progress.currentMbps} Mbps (${progress.progressPct}%)`
                : `Subiendo: ${progress.currentMbps} Mbps (${progress.progressPct}%)`,
          });
        },
      );

      // Paso 3: Geolocalización y Persistencia en SQLite (RF-04)
      set({
        status: 'locating',
        statusMessage: 'Obteniendo coordenadas GPS y guardando sesión...',
      });

      let location: LocationCoordinates | null = null;
      try {
        location = await LocationService.getCurrentLocation();
      } catch (locErr) {
        console.warn('[QoSStore] No se pudo obtener ubicación GPS:', locErr);
      }

      // Obtener snapshot de red y telefonía
      const netState = useNetworkStore.getState();
      const networkType = netState.network.kind;
      const operator = netState.cellular?.operator || netState.network.carrier || 'Desconocido';
      const cellularGen = netState.cellular?.generation || netState.network.cellularGeneration || null;
      const signalDbm = netState.cellular?.signalDbm ?? null;
      const signalLevel = netState.cellular?.signalLevel ?? (netState.network.wifiStrength != null ? Math.round(netState.network.wifiStrength / 25) : null);

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let insertedId = 0;

      const minRtt = pingResult.results.length > 0 ? Math.min(...pingResult.results.map(r => r.rttMin).filter(v => v > 0)) : null;
      const maxRtt = pingResult.results.length > 0 ? Math.max(...pingResult.results.map(r => r.rttMax)) : null;
      const lossPct = pingResult.results.length > 0
        ? Math.round(pingResult.results.reduce((acc, r) => acc + r.packetLossPct, 0) / pingResult.results.length)
        : 0;

      try {
        insertedId = await insertMeasurement({
          sessionId,
          timestamp: Date.now(),
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          altitude: location?.altitude ?? null,
          accuracy: location?.accuracy ?? null,
          networkType,
          cellularGeneration: cellularGen,
          operator,
          signalDbm,
          signalLevel,
          pingAvgMs: pingResult.overallAvgRtt,
          pingMinMs: Number.isFinite(minRtt) ? minRtt : null,
          pingMaxMs: Number.isFinite(maxRtt) ? maxRtt : null,
          jitterMs: pingResult.overallJitter,
          packetLossPct: lossPct,
          downloadMbps: throughputResult.downloadMbps,
          uploadMbps: throughputResult.uploadMbps,
          notes: 'Medición manual desde Dashboard',
        });
        console.log('[QoSStore] Medición guardada en SQLite con ID:', insertedId);
      } catch (dbErr) {
        console.error('[QoSStore] Error al guardar en SQLite:', dbErr);
      }

      set({
        status: 'completed',
        statusMessage: `¡Test completado! Guardado en SQLite (ID #${insertedId})`,
        throughputResult,
        lastLocation: location,
        lastSavedId: insertedId,
        liveThroughput: null,
      });
    } catch (err: any) {
      console.warn('[QoSStore] Error en test:', err);
      set({
        status: 'error',
        statusMessage: err.message || 'Error durante la ejecución del test',
        lastError: err.message,
      });
    }
  },
}));
