import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '../../store/networkStore';
import { useQoSStore } from '../../store/qosStore';
import { getCellularInfo } from '../../core/native/TelephonyModule';
import type { NetworkSnapshot } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

const KIND_LABEL: Record<NetworkSnapshot['kind'], string> = {
  wifi: 'Wi-Fi',
  cellular: 'Datos móviles',
  ethernet: 'Ethernet',
  none: 'Sin conexión',
  unknown: 'Detectando…',
  other: 'Otra',
};

function getDbmQuality(dbm: number | null): { label: string; color: string } {
  if (dbm == null) return { label: 'No disponible', color: colors.textMuted };
  if (dbm >= -85) return { label: 'Excelente', color: colors.good };
  if (dbm >= -100) return { label: 'Buena', color: colors.good };
  if (dbm >= -112) return { label: 'Regular', color: colors.fair };
  return { label: 'Mala / Débil', color: colors.poor };
}

function SignalBars({ level }: { level: number }) {
  const barHeights = [6, 11, 16, 21];
  const barColor =
    level >= 3 ? colors.good : level >= 2 ? colors.fair : colors.poor;

  return (
    <View style={styles.barsContainer}>
      {barHeights.map((h, i) => {
        const active = i < level;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              { height: h },
              active ? { backgroundColor: barColor } : styles.barInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={[typography.body, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const network = useNetworkStore(s => s.network);
  const cellular = useNetworkStore(s => s.cellular);
  const transitions = useNetworkStore(s => s.transitions);

  const {
    status: qosStatus,
    statusMessage,
    pingResult,
    throughputResult,
    liveThroughput,
    lastError,
    runTest,
  } = useQoSStore();

  const [refreshing, setRefreshing] = useState(false);

  const isTesting =
    qosStatus === 'pinging' ||
    qosStatus === 'downloading' ||
    qosStatus === 'uploading';

  const statusColor = !network.isConnected
    ? colors.poor
    : network.isInternetReachable === false
    ? colors.fair
    : colors.good;

  const onManualRefresh = async () => {
    setRefreshing(true);
    try {
      const info = await getCellularInfo();
      useNetworkStore.setState({ cellular: info });
    } finally {
      setRefreshing(false);
    }
  };

  const signalQuality = getDbmQuality(cellular?.signalDbm ?? null);
  const displayOperator =
    cellular?.operator && cellular.operator !== 'Sin red celular'
      ? cellular.operator
      : network.carrier || 'No detectado';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.md },
      ]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={typography.title}>Dashboard</Text>
        <Pressable
          onPress={onManualRefresh}
          disabled={refreshing || isTesting}
          style={({ pressed }) => [
            styles.refreshBtn,
            pressed && styles.btnPressed,
          ]}>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.refreshBtnText}>🔄 Actualizar</Text>
          )}
        </Pressable>
      </View>

      {/* Hero: Estado de Conexión */}
      <View style={styles.hero}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <View style={styles.heroText}>
          <Text style={typography.caption}>Conexión activa</Text>
          <Text style={typography.metric}>
            {KIND_LABEL[network.kind]}
            {cellular?.generation && cellular.generation !== 'unknown'
              ? ` · ${cellular.generation.toUpperCase()}`
              : network.cellularGeneration
              ? ` · ${network.cellularGeneration.toUpperCase()}`
              : ''}
          </Text>
        </View>
        <SignalBars
          level={cellular?.signalLevel ?? (network.kind === 'wifi' ? 4 : 0)}
        />
      </View>

      {/* SECCIÓN 1: MOTOR DE MEDICIÓN QoS (RF-02 y RF-03) */}
      <View style={styles.sectionHeader}>
        <Text style={typography.subtitle}>Test de Rendimiento QoS</Text>
        <Text style={styles.nativeBadge}>RF-02 / RF-03</Text>
      </View>

      {/* Botón principal de Test */}
      <Pressable
        onPress={runTest}
        disabled={isTesting}
        style={({ pressed }) => [
          styles.testCta,
          isTesting && styles.testCtaActive,
          pressed && styles.btnPressed,
        ]}>
        {isTesting ? (
          <View style={styles.ctaRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.testCtaText}>Midiendo Calidad de Red...</Text>
          </View>
        ) : (
          <Text style={styles.testCtaText}>▶ Iniciar Test de QoS</Text>
        )}
      </Pressable>

      {/* Estado del Test en Progreso */}
      {isTesting || qosStatus === 'completed' || qosStatus === 'error' ? (
        <View
          style={[
            styles.progressBox,
            qosStatus === 'completed' && styles.progressBoxDone,
            qosStatus === 'error' && styles.progressBoxError,
          ]}>
          <Text style={styles.progressText}>{statusMessage}</Text>
          {liveThroughput ? (
            <View style={styles.liveBarTrack}>
              <View
                style={[
                  styles.liveBarFill,
                  { width: `${liveThroughput.progressPct}%` },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Tarjetas de Métricas de Throughput y Latencia */}
      <View style={styles.metricsGrid}>
        {/* Bajada */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>⬇️ DESCARGA</Text>
          <Text style={styles.metricBig}>
            {liveThroughput?.phase === 'download'
              ? liveThroughput.currentMbps
              : throughputResult?.downloadMbps != null
              ? throughputResult.downloadMbps
              : '—'}
          </Text>
          <Text style={styles.metricUnit}>Mbps</Text>
        </View>

        {/* Subida */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>⬆️ SUBIDA</Text>
          <Text style={styles.metricBig}>
            {liveThroughput?.phase === 'upload'
              ? liveThroughput.currentMbps
              : throughputResult?.uploadMbps != null
              ? throughputResult.uploadMbps
              : '—'}
          </Text>
          <Text style={styles.metricUnit}>Mbps</Text>
        </View>

        {/* RTT Promedio */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>⏱️ LATENCIA RTT</Text>
          <Text style={styles.metricBig}>
            {pingResult?.overallAvgRtt != null
              ? `${pingResult.overallAvgRtt}`
              : '—'}
          </Text>
          <Text style={styles.metricUnit}>ms (promedio)</Text>
        </View>

        {/* Jitter */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>⚡ JITTER</Text>
          <Text style={styles.metricBig}>
            {pingResult?.overallJitter != null
              ? `${pingResult.overallJitter}`
              : '—'}
          </Text>
          <Text style={styles.metricUnit}>ms (RFC 3550)</Text>
        </View>
      </View>

      {/* Detalle de Sondas TCP por Host (RF-02) */}
      {pingResult?.results && pingResult.results.length > 0 ? (
        <View style={styles.hostDetailsCard}>
          <Text style={styles.hostDetailsTitle}>
            Desglose de Sondas TCP por Host
          </Text>
          {pingResult.results.map(h => (
            <View key={h.hostId} style={styles.hostResultRow}>
              <View style={styles.hostResultHeader}>
                <Text style={styles.hostResultName}>{h.name}</Text>
                <Text style={styles.hostResultTarget}>
                  {h.host}:{h.port}
                </Text>
              </View>
              <View style={styles.hostStatsGrid}>
                <View style={styles.hostStatCol}>
                  <Text style={styles.statLabel}>Min</Text>
                  <Text style={styles.statVal}>{h.rttMin} ms</Text>
                </View>
                <View style={styles.hostStatCol}>
                  <Text style={styles.statLabel}>Avg</Text>
                  <Text style={[styles.statVal, { color: colors.primary }]}>
                    {h.rttAvg} ms
                  </Text>
                </View>
                <View style={styles.hostStatCol}>
                  <Text style={styles.statLabel}>Max</Text>
                  <Text style={styles.statVal}>{h.rttMax} ms</Text>
                </View>
                <View style={styles.hostStatCol}>
                  <Text style={styles.statLabel}>Jitter</Text>
                  <Text style={styles.statVal}>{h.jitter} ms</Text>
                </View>
                <View style={styles.hostStatCol}>
                  <Text style={styles.statLabel}>Pérdida</Text>
                  <Text
                    style={[
                      styles.statVal,
                      { color: h.packetLossPct > 0 ? colors.poor : colors.good },
                    ]}>
                    {h.packetLossPct}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* SECCIÓN 2: TELEFONÍA CELULAR (KOTLIN BRIDGE - RF-01) */}
      <View style={styles.sectionHeader}>
        <Text style={typography.subtitle}>Métricas de Telefonía (Nativo)</Text>
        <Text style={styles.nativeBadge}>RF-01</Text>
      </View>
      <View style={styles.card}>
        <Row label="Operador celular" value={displayOperator} />
        <Row
          label="Tecnología celular"
          value={cellular?.technology ?? 'No disponible'}
        />
        <Row
          label="Potencia de señal (dBm)"
          value={
            cellular?.signalDbm != null
              ? `${cellular.signalDbm} dBm`
              : 'N/A (En Wi-Fi o sin SIM)'
          }
          valueColor={
            cellular?.signalDbm != null ? signalQuality.color : undefined
          }
        />
        <Row
          label="Calidad estimada"
          value={signalQuality.label}
          valueColor={signalQuality.color}
        />
        <Row
          label="Barras de señal"
          value={
            cellular?.signalLevel != null ? `${cellular.signalLevel} de 4` : '—'
          }
        />
        {cellular?.asuLevel ? (
          <Row label="Nivel ASU" value={`${cellular.asuLevel}`} />
        ) : null}
      </View>

      {/* SECCIÓN 3: CONECTIVIDAD GENERAL */}
      <Text style={[typography.subtitle, styles.sectionTitle]}>
        Estado de Conectividad
      </Text>
      <View style={styles.card}>
        <Row
          label="Internet alcanzable"
          value={
            network.isInternetReachable == null
              ? '—'
              : network.isInternetReachable
              ? 'Sí'
              : 'No'
          }
          valueColor={network.isInternetReachable ? colors.good : colors.poor}
        />
        {network.kind === 'wifi' && (
          <>
            <Row
              label="SSID Wi-Fi"
              value={network.wifiSsid ?? '— (requiere ubicación)'}
            />
            <Row
              label="Intensidad Wi-Fi"
              value={
                network.wifiStrength != null
                  ? `${network.wifiStrength}%`
                  : '—'
              }
            />
          </>
        )}
      </View>

      {/* SECCIÓN 4: HISTORIAL DE TRANSICIONES */}
      <Text style={[typography.subtitle, styles.sectionTitle]}>
        Cambios de Red Recientes
      </Text>
      <View style={styles.card}>
        {transitions.length === 0 ? (
          <Text style={typography.caption}>
            Sin cambios de red desde que se abrió la app.
          </Text>
        ) : (
          transitions.slice(0, 5).map(t => (
            <Row
              key={t.at}
              label={new Date(t.at).toLocaleTimeString()}
              value={`${KIND_LABEL[t.from]} → ${KIND_LABEL[t.to]}`}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  btnPressed: { opacity: 0.7 },
  hero: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.md },
  heroText: { flex: 1 },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    gap: 3,
    paddingLeft: spacing.sm,
  },
  bar: { width: 4, borderRadius: 2 },
  barInactive: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.xs },
  nativeBadge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  testCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testCtaActive: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  testCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  progressBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  progressBoxDone: { borderColor: colors.good },
  progressBoxError: { borderColor: colors.poor },
  progressText: { color: colors.text, fontSize: 13, textAlign: 'center' },
  liveBarTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  liveBarFill: { height: '100%', backgroundColor: colors.good },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricBig: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  metricUnit: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  hostDetailsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  hostDetailsTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  hostResultRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  hostResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hostResultName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  hostResultTarget: { color: colors.textMuted, fontSize: 12 },
  hostStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hostStatCol: { alignItems: 'center' },
  statLabel: { color: colors.textMuted, fontSize: 10 },
  statVal: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
});
