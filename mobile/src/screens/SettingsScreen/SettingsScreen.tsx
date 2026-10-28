import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQoSStore } from '../../store/qosStore';
import { useMonitoringStore } from '../../store/monitoringStore';
import { BackgroundMonitorService } from '../../core/monitoring/BackgroundMonitorService';
import { NotificationService } from '../../core/notifications/NotificationService';
import type { PingHostConfig } from '../../core/engine/PingEngine';
import { colors, radius, spacing, typography } from '../../theme';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { backendUrl, hosts, setBackendUrl, setHosts } = useQoSStore();

  const isMonitoring = useMonitoringStore(s => s.isEnabled);
  const monitoringInterval = useMonitoringStore(s => s.intervalMinutes);
  const rttThreshold = useMonitoringStore(s => s.alertRttThresholdMs);
  const sampleCount = useMonitoringStore(s => s.sampleCount);
  const alertCount = useMonitoringStore(s => s.alertCount);
  const lastSampleAt = useMonitoringStore(s => s.lastSampleAt);
  const setIntervalMinutes = useMonitoringStore(s => s.setIntervalMinutes);
  const setAlertRttThresholdMs = useMonitoringStore(s => s.setAlertRttThresholdMs);

  const [inputUrl, setInputUrl] = useState(backendUrl);
  const [hostsState, setHostsState] = useState<PingHostConfig[]>(hosts);

  const handleSave = () => {
    setBackendUrl(inputUrl.trim());
    setHosts(hostsState);
    Alert.alert('Configuración guardada', 'Los hosts y URL del backend fueron actualizados.');
  };

  const handleToggleMonitoring = () => {
    if (isMonitoring) {
      BackgroundMonitorService.stop();
    } else {
      BackgroundMonitorService.start();
    }
  };

  const handleSetInterval = (min: number) => {
    setIntervalMinutes(min);
    if (isMonitoring) {
      BackgroundMonitorService.start();
    }
  };

  const handleTestNotification = async () => {
    await NotificationService.sendTestNotification();
    Alert.alert('Notificación enviada', 'Revisá la barra de estado superior de Android.');
  };

  const handleSimulateDegradation = async () => {
    await BackgroundMonitorService.simulateDegradationAlert();
    Alert.alert('Alerta simulada', 'Se disparó una alerta crítica (RTT > 250 ms) y se registró en SQLite.');
  };

  const updateHost = (index: number, key: 'host' | 'port', val: string) => {
    const next = [...hostsState];
    if (key === 'port') {
      next[index] = { ...next[index], port: Number(val) || 80 };
    } else {
      next[index] = { ...next[index], host: val };
    }
    setHostsState(next);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}>
      <Text style={typography.title}>Ajustes de QoS</Text>
      <Text style={[typography.caption, styles.subtitle]}>
        Configurá los hosts de sondeo RTT y el backend de referencia para throughput.
      </Text>

      {/* Backend Reference URL */}
      <Text style={[typography.subtitle, styles.sectionTitle]}>
        Backend de Referencia (Throughput)
      </Text>
      <View style={styles.card}>
        <Text style={typography.caption}>URL del servidor (10.0.2.2 es el host en emulador)</Text>
        <TextInput
          style={styles.input}
          value={inputUrl}
          onChangeText={setInputUrl}
          placeholder="http://10.0.2.2:3000"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* 3 Configurable Hosts (RF-02) */}
      <Text style={[typography.subtitle, styles.sectionTitle]}>
        Hosts de Sondas TCP (RF-02)
      </Text>
      {hostsState.map((h: PingHostConfig, i: number) => (
        <View key={h.id} style={styles.hostCard}>
          <Text style={styles.hostName}>{h.name}</Text>
          <View style={styles.hostRow}>
            <View style={styles.flexHost}>
              <Text style={typography.caption}>Host / IP</Text>
              <TextInput
                style={styles.input}
                value={h.host}
                onChangeText={v => updateHost(i, 'host', v)}
                placeholder="IP o Dominio"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.portBox}>
              <Text style={typography.caption}>Puerto</Text>
              <TextInput
                style={styles.input}
                value={String(h.port)}
                onChangeText={v => updateHost(i, 'port', v)}
                keyboardType="numeric"
                placeholder="80"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>
      ))}

      {/* Muestreo en Segundo Plano y Alertas (RF-07) */}
      <Text style={[typography.subtitle, styles.sectionTitle]}>
        Muestreo Periódico y Alertas (RF-07)
      </Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextContainer}>
            <Text style={styles.switchLabel}>Monitoreo en Segundo Plano</Text>
            <Text style={typography.caption}>
              Sondea latencia periódicamente y emite alertas ante degradación severa.
            </Text>
          </View>
          <Pressable
            style={[styles.togglePill, isMonitoring && styles.togglePillActive]}
            onPress={handleToggleMonitoring}>
            <Text style={styles.togglePillText}>{isMonitoring ? 'ACTIVO' : 'INACTIVO'}</Text>
          </Pressable>
        </View>

        {/* Intervalo */}
        <Text style={[typography.caption, { marginTop: spacing.md }]}>
          Intervalo de muestreo:
        </Text>
        <View style={styles.chipRow}>
          {[1, 5, 15].map(min => (
            <Pressable
              key={`interval-${min}`}
              style={[
                styles.chip,
                monitoringInterval === min && styles.chipActive,
              ]}
              onPress={() => handleSetInterval(min)}>
              <Text
                style={[
                  styles.chipText,
                  monitoringInterval === min && styles.chipTextActive,
                ]}>
                {min === 1 ? '1 min (Demo)' : `${min} min`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Umbral de Latencia */}
        <Text style={[typography.caption, { marginTop: spacing.md }]}>
          Umbral de latencia para alerta (RTT):
        </Text>
        <View style={styles.chipRow}>
          {[200, 250, 350].map(ms => (
            <Pressable
              key={`rtt-${ms}`}
              style={[
                styles.chip,
                rttThreshold === ms && styles.chipActive,
              ]}
              onPress={() => setAlertRttThresholdMs(ms)}>
              <Text
                style={[
                  styles.chipText,
                  rttThreshold === ms && styles.chipTextActive,
                ]}>
                {ms === 250 ? `${ms} ms (RFC)` : `${ms} ms`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Estadísticas de Muestreo */}
        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{sampleCount}</Text>
            <Text style={styles.statLabel}>Muestras</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statNumber, { color: alertCount > 0 ? colors.poor : colors.good }]}>
              {alertCount}
            </Text>
            <Text style={styles.statLabel}>Alertas</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>
              {lastSampleAt ? new Date(lastSampleAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
            <Text style={styles.statLabel}>Última sonda</Text>
          </View>
        </View>

        {/* Botones de Prueba de Notificación */}
        <View style={styles.actionBtnRow}>
          <Pressable
            style={styles.testBtn}
            onPress={handleTestNotification}>
            <Text style={styles.testBtnText}>🔔 Probar Notificación</Text>
          </Pressable>

          <Pressable
            style={styles.simulateAlertBtn}
            onPress={handleSimulateDegradation}>
            <Text style={styles.simulateAlertBtnText}>⚡ Simular Alerta Severa</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={handleSave}
        style={({ pressed }) => [styles.saveBtn, pressed && styles.btnPressed]}>
        <Text style={styles.saveBtnText}>Guardar Configuración</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  hostCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  hostName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  hostRow: { flexDirection: 'row', gap: spacing.sm },
  flexHost: { flex: 3 },
  portBox: { flex: 1 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnPressed: { opacity: 0.8 },

  // RF-07 Monitoring Styles
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  togglePillActive: {
    backgroundColor: colors.good,
    borderColor: colors.good,
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCol: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  testBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  simulateAlertBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 92, 122, 0.12)',
    borderWidth: 1,
    borderColor: colors.poor,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateAlertBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.poor,
  },
});
