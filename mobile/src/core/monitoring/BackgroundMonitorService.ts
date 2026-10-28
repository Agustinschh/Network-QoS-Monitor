import { runPingSuite, DEFAULT_PING_HOSTS } from '../engine/PingEngine';
import { NotificationService } from '../notifications/NotificationService';
import { useMonitoringStore } from '../../store/monitoringStore';
import { useNetworkStore } from '../../store/networkStore';
import { LocationService } from '../geo/LocationService';
import { insertMeasurement } from '../../database/db';
import type { MeasurementRecord } from '../../database/schema';

export class BackgroundMonitorService {
  private static timerId: any = null;
  private static isRunning = false;

  /**
   * Inicia el muestreo periódico en background según la configuración activa.
   */
  public static start(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    const { intervalMinutes, setEnabled } = useMonitoringStore.getState();
    setEnabled(true);

    const intervalMs = Math.max(intervalMinutes * 60 * 1000, 30 * 1000); // Mínimo 30s
    console.log(`[BackgroundMonitorService] Iniciando monitoreo cada ${intervalMinutes} min (${intervalMs}ms)`);

    // Ejecutar primera muestra inmediatamente
    this.runSingleSample();

    this.timerId = setInterval(() => {
      this.runSingleSample();
    }, intervalMs);

    NotificationService.init();
  }

  /**
   * Detiene el muestreo periódico.
   */
  public static stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    useMonitoringStore.getState().setEnabled(false);
    console.log('[BackgroundMonitorService] Monitoreo detenido.');
  }

  /**
   * Ejecuta una sonda de muestreo en segundo plano y evalúa degradación (RF-07).
   */
  public static async runSingleSample(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      console.log('[BackgroundMonitorService] Ejecutando muestra periódica QoS...');
      const store = useMonitoringStore.getState();
      const netState = useNetworkStore.getState();

      // 1. Sonda rápida de latencia (2 probes contra 2 hosts para ahorrar batería y ancho de banda)
      const primaryHosts = DEFAULT_PING_HOSTS.slice(0, 2);
      const pingResult = await runPingSuite(primaryHosts, 2);

      // 2. Parámetros de telefonía y red
      const networkType = netState.network.kind;
      const operator = netState.cellular?.operator || netState.network.carrier || 'Desconocido';
      const cellularGen = netState.cellular?.generation || netState.network.cellularGeneration || null;
      const signalDbm = netState.cellular?.signalDbm ?? null;
      const signalLevel = netState.cellular?.signalLevel ?? null;

      // 3. Ubicación GPS
      let location: { latitude: number; longitude: number; altitude: number | null; accuracy: number | null } | null = null;
      try {
        location = await LocationService.getCurrentLocation();
      } catch (e) {
        console.warn('[BackgroundMonitorService] GPS no disponible para muestra en background:', e);
      }

      // 4. Evaluar umbrales de degradación severa (RF-07)
      const avgRtt = pingResult.overallAvgRtt;
      const jitter = pingResult.overallJitter;
      const lossPct =
        pingResult.results.length > 0
          ? Math.round(pingResult.results.reduce((a, b) => a + b.packetLossPct, 0) / pingResult.results.length)
          : 0;

      let isDegraded = false;
      let alertReason = '';
      let metricType: 'rtt' | 'signal' | 'loss' = 'rtt';
      let metricValue = 0;
      let threshold = 0;

      if (avgRtt > store.alertRttThresholdMs) {
        isDegraded = true;
        alertReason = `Latencia RTT crítica: ${avgRtt} ms (Umbral: >${store.alertRttThresholdMs} ms)`;
        metricType = 'rtt';
        metricValue = avgRtt;
        threshold = store.alertRttThresholdMs;
      } else if (signalDbm != null && signalDbm < store.alertSignalThresholdDbm) {
        isDegraded = true;
        alertReason = `Señal celular muy débil: ${signalDbm} dBm (Umbral: <${store.alertSignalThresholdDbm} dBm)`;
        metricType = 'signal';
        metricValue = signalDbm;
        threshold = store.alertSignalThresholdDbm;
      } else if (lossPct >= 50) {
        isDegraded = true;
        alertReason = `Pérdida severa de paquetes: ${lossPct}% (Umbral: ≥50%)`;
        metricType = 'loss';
        metricValue = lossPct;
        threshold = 50;
      }

      // 5. Disparar alerta si hubo degradación
      if (isDegraded) {
        await NotificationService.sendDegradationAlert({
          title: '⚠️ Alerta de Degradación de Red',
          body: alertReason,
          metricType,
          metricValue,
          threshold,
        });

        store.recordAlert({
          title: '⚠️ Degradación de Red',
          message: alertReason,
          metricType,
          metricValue,
          threshold,
        });
      }

      // 6. Guardar la muestra en SQLite (RF-04)
      const record: Omit<MeasurementRecord, 'id'> = {
        sessionId: `bg_${Date.now()}`,
        timestamp: Date.now(),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        altitude: location?.altitude ?? null,
        accuracy: location?.accuracy ?? null,
        networkType,
        operator,
        cellularGeneration: cellularGen,
        signalDbm,
        signalLevel,
        pingMinMs: pingResult.results[0]?.rttMin ?? null,
        pingAvgMs: avgRtt,
        pingMaxMs: pingResult.results[0]?.rttMax ?? null,
        jitterMs: jitter,
        packetLossPct: lossPct,
        downloadMbps: null,
        uploadMbps: null,
        notes: isDegraded ? `[BACKGROUND_ALERT] ${alertReason}` : '[BACKGROUND_SAMPLE]',
      };

      await insertMeasurement(record);
      store.recordSample();
      console.log('[BackgroundMonitorService] Muestra guardada exitosamente. RTT:', avgRtt, 'ms, Degradado:', isDegraded);
    } catch (err) {
      console.warn('[BackgroundMonitorService] Error ejecutando muestra en background:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Simula una degradación severa inmediata (ideal para tests y presentación académica).
   */
  public static async simulateDegradationAlert(): Promise<void> {
    const store = useMonitoringStore.getState();
    const mockRtt = 340; // Simula 340ms (superior al umbral de 250ms)
    const alertReason = `Latencia crítica simulada: ${mockRtt} ms (Umbral: >${store.alertRttThresholdMs} ms)`;

    await NotificationService.sendDegradationAlert({
      title: '⚠️ Degradación Severa (Simulación)',
      body: alertReason,
      metricType: 'rtt',
      metricValue: mockRtt,
      threshold: store.alertRttThresholdMs,
    });

    store.recordAlert({
      title: '⚠️ Degradación Severa (Simulación)',
      message: alertReason,
      metricType: 'rtt',
      metricValue: mockRtt,
      threshold: store.alertRttThresholdMs,
    });

    // Guardar también en SQLite
    const netState = useNetworkStore.getState();
    let location = null;
    try {
      location = await LocationService.getCurrentLocation();
    } catch (_) {}

    await insertMeasurement({
      sessionId: `sim_alert_${Date.now()}`,
      timestamp: Date.now(),
      latitude: location?.latitude ?? 37.422,
      longitude: location?.longitude ?? -122.084,
      altitude: null,
      accuracy: 10,
      networkType: netState.network.kind,
      operator: netState.cellular?.operator || 'T-Mobile',
      cellularGeneration: netState.cellular?.generation || '5G NR',
      signalDbm: -118, // También simula señal débil
      signalLevel: 1,
      pingMinMs: 310,
      pingAvgMs: mockRtt,
      pingMaxMs: 410,
      jitterMs: 45.2,
      packetLossPct: 20,
      downloadMbps: 4.2,
      uploadMbps: 0.8,
      notes: '[SIMULATED_DEGRADATION_ALERT]',
    });

    store.recordSample();
  }
}
