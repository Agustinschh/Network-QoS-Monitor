import { create } from 'zustand';

export interface MonitoringAlert {
  id: string;
  timestamp: number;
  title: string;
  message: string;
  metricType: 'rtt' | 'signal' | 'loss';
  metricValue: number;
  threshold: number;
}

interface MonitoringStore {
  isEnabled: boolean;
  intervalMinutes: number;
  alertRttThresholdMs: number;
  alertSignalThresholdDbm: number;
  lastSampleAt: number | null;
  lastAlertAt: number | null;
  sampleCount: number;
  alertCount: number;
  recentAlerts: MonitoringAlert[];

  // Actions
  setEnabled: (enabled: boolean) => void;
  setIntervalMinutes: (minutes: number) => void;
  setAlertRttThresholdMs: (ms: number) => void;
  recordSample: () => void;
  recordAlert: (alert: Omit<MonitoringAlert, 'id' | 'timestamp'>) => void;
  clearAlerts: () => void;
}

export const useMonitoringStore = create<MonitoringStore>((set, get) => ({
  isEnabled: false,
  intervalMinutes: 1, // 1 minuto por defecto para pruebas y evaluación de cátedra
  alertRttThresholdMs: 250, // 250 ms (especificación RF-07)
  alertSignalThresholdDbm: -115, // -115 dBm (especificación RF-07)
  lastSampleAt: null,
  lastAlertAt: null,
  sampleCount: 0,
  alertCount: 0,
  recentAlerts: [],

  setEnabled: (enabled: boolean) => {
    set({ isEnabled: enabled });
  },

  setIntervalMinutes: (minutes: number) => {
    set({ intervalMinutes: minutes });
  },

  setAlertRttThresholdMs: (ms: number) => {
    set({ alertRttThresholdMs: ms });
  },

  recordSample: () => {
    set(state => ({
      sampleCount: state.sampleCount + 1,
      lastSampleAt: Date.now(),
    }));
  },

  recordAlert: alert => {
    const newAlert: MonitoringAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };

    set(state => ({
      alertCount: state.alertCount + 1,
      lastAlertAt: Date.now(),
      recentAlerts: [newAlert, ...state.recentAlerts.slice(0, 19)],
    }));
  },

  clearAlerts: () => {
    set({ recentAlerts: [], alertCount: 0 });
  },
}));
