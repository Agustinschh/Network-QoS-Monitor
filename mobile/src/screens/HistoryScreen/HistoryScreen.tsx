import React, { useState, useEffect, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme';
import {
  getMeasurements,
  clearAllMeasurements,
  deleteMeasurement,
  type QueryFilters,
} from '../../database/db';
import type { MeasurementRecord } from '../../database/schema';

import { QoSBarChart } from '../../components/charts/QoSBarChart';
import { ExportService } from '../../core/export/ExportService';

export function HistoryScreen() {
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showCharts, setShowCharts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const filters: QueryFilters = {
        limit: 100,
        networkType: filterType === 'ALL' ? undefined : filterType,
      };
      const list = await getMeasurements(filters);
      setMeasurements(list);
    } catch (e) {
      console.warn('[HistoryScreen] Error cargando datos:', e);
    }
  }, [filterType]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Vaciar Historial',
      '¿Está seguro de eliminar todas las mediciones guardadas en la base de datos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await clearAllMeasurements();
            await loadData();
          },
        },
      ],
    );
  };

  const handleDeleteItem = async (id?: number) => {
    if (!id) return;
    await deleteMeasurement(id);
    await loadData();
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const handleExportPrompt = (format: 'csv' | 'json') => {
    const ext = format.toUpperCase();
    if (measurements.length === 0) {
      Alert.alert('Sin datos', 'No hay registros para exportar.');
      return;
    }

    Alert.alert(
      `Exportar Historial (${ext})`,
      `Seleccione el destino para exportar las ${measurements.length} mediciones:`,
      [
        {
          text: '💾 Guardar en Descargas',
          onPress: async () => {
            const res = await ExportService.saveToDownloads(format, measurements);
            if (res.success) {
              Alert.alert(
                'Archivo Guardado',
                `Archivo ${ext} guardado exitosamente en:\n\n${res.filePath}`,
              );
            } else {
              Alert.alert('Error al guardar', res.error || 'No se pudo guardar el archivo');
            }
          },
        },
        {
          text: '↗️ Compartir',
          onPress: async () => {
            await ExportService.share(format, measurements);
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  // Preparar datos temporales para gráficos (RF-06)
  const recentMeasurements = measurements.slice(0, 6).reverse();
  const throughputChartData = recentMeasurements.map((m, idx) => ({
    label: `#${m.id ?? idx + 1}`,
    subLabel: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: m.downloadMbps || 0,
    secondaryValue: m.uploadMbps || 0,
  }));

  const latencyChartData = recentMeasurements.map((m, idx) => ({
    label: `#${m.id ?? idx + 1}`,
    subLabel: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: m.pingAvgMs || 0,
    secondaryValue: m.jitterMs || 0,
    color: colors.fair,
  }));

  const renderItem = ({ item }: { item: MeasurementRecord }) => {
    const isCell = item.networkType === 'cellular';
    const netBadgeColor = isCell ? colors.primary : colors.good;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.badge, { backgroundColor: netBadgeColor }]}>
              <Text style={styles.badgeText}>
                {item.cellularGeneration || item.networkType.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.operatorText}>{item.operator || 'Operador N/A'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteItem(item.id)}
            style={styles.deleteBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.deleteBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.timestampText}>{formatTimestamp(item.timestamp)}</Text>

        {/* Métricas Principales */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Descarga</Text>
            <Text style={[styles.metricValue, { color: colors.good }]}>
              {item.downloadMbps != null ? `${item.downloadMbps.toFixed(1)} Mbps` : '—'}
            </Text>
          </View>

          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Subida</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>
              {item.uploadMbps != null ? `${item.uploadMbps.toFixed(1)} Mbps` : '—'}
            </Text>
          </View>

          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>RTT Promedio</Text>
            <Text style={[styles.metricValue, { color: colors.fair }]}>
              {item.pingAvgMs != null ? `${item.pingAvgMs} ms` : '—'}
            </Text>
          </View>

          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Jitter RFC3550</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {item.jitterMs != null ? `${item.jitterMs} ms` : '—'}
            </Text>
          </View>
        </View>

        {/* Coordenadas GPS y Señal */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerInfo}>
            📍{' '}
            {item.latitude != null && item.longitude != null
              ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`
              : 'Sin GPS'}
          </Text>
          <Text style={styles.footerInfo}>
            📶 {item.signalDbm != null ? `${item.signalDbm} dBm` : 'N/D'}
            {item.signalLevel != null ? ` (Nivel ${item.signalLevel}/4)` : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    if (measurements.length === 0) return null;

    return (
      <View style={styles.chartsHeaderWrapper}>
        <TouchableOpacity
          style={styles.toggleChartsBtn}
          onPress={() => setShowCharts(!showCharts)}>
          <Text style={styles.toggleChartsText}>
            {showCharts ? '▼ Ocultar Gráficos Temporales' : '▶ Ver Gráficos de Sesión (RF-06)'}
          </Text>
        </TouchableOpacity>

        {showCharts && (
          <View style={styles.chartsContainer}>
            <QoSBarChart
              title="Throughput por Sesión (RF-06)"
              data={throughputChartData}
              unit="Mbps"
              primaryLegend="Descarga"
              secondaryLegend="Subida"
              maxHeight={130}
            />

            <QoSBarChart
              title="Latencia RTT & Jitter (RFC 3550)"
              data={latencyChartData}
              unit="ms"
              primaryLegend="RTT Prom."
              secondaryLegend="Jitter"
              maxHeight={130}
            />
          </View>
        )}

        <Text style={styles.historyListTitle}>Listado Cronológico</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Historial de Mediciones</Text>
          <Text style={styles.subtitle}>
            {measurements.length} {measurements.length === 1 ? 'registro' : 'registros'} guardados (SQLite)
          </Text>
        </View>
        {measurements.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearBtnText}>Vaciar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selector de Filtros (RF-09) */}
      <View style={styles.filterRow}>
        {(['ALL', 'cellular', 'wifi'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, filterType === type && styles.filterChipActive]}
            onPress={() => setFilterType(type)}>
            <Text
              style={[
                styles.filterChipText,
                filterType === type && styles.filterChipTextActive,
              ]}>
              {type === 'ALL' ? 'Todos' : type === 'cellular' ? 'Móvil / Datos' : 'Wi-Fi'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Barra de Exportación (RF-08) */}
      <View style={styles.exportBar}>
        <Text style={styles.exportLabel}>Exportar (RF-08):</Text>
        <View style={styles.exportBtnGroup}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => handleExportPrompt('csv')}
            activeOpacity={0.7}>
            <Text style={styles.exportBtnText}>📄 CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, styles.exportBtnJson]}
            onPress={() => handleExportPrompt('json')}
            activeOpacity={0.7}>
            <Text style={styles.exportBtnText}>📦 JSON</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={measurements}
        keyExtractor={item => (item.id ? item.id.toString() : String(item.timestamp))}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sin mediciones registradas</Text>
            <Text style={styles.emptyText}>
              Ejecute una prueba de QoS desde el Dashboard para guardar su primera sesión georreferenciada.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  exportBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  exportLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exportBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exportBtnJson: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  operatorText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  timestampText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  metricCol: {
    width: '50%',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInfo: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  chartsHeaderWrapper: {
    marginBottom: 16,
  },
  toggleChartsBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleChartsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  chartsContainer: {
    marginBottom: 12,
  },
  historyListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
  },
});
