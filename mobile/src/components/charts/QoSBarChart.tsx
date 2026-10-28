import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

export interface BarDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  subLabel?: string;
  color?: string;
}

export interface QoSBarChartProps {
  title: string;
  data: BarDataPoint[];
  unit: string;
  primaryLegend?: string;
  secondaryLegend?: string;
  maxHeight?: number;
}

export function QoSBarChart({
  title,
  data,
  unit,
  primaryLegend = 'Métrica',
  secondaryLegend,
  maxHeight = 150,
}: QoSBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>Sin datos suficientes para graficar</Text>
      </View>
    );
  }

  const allValues = data.flatMap(d => (d.secondaryValue != null ? [d.value, d.secondaryValue] : [d.value]));
  const maxValue = Math.max(...allValues, 1);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.good }]} />
            <Text style={styles.legendText}>{primaryLegend}</Text>
          </View>
          {secondaryLegend && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>{secondaryLegend}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.chartBody, { height: maxHeight }]}>
        {data.map((item, index) => {
          const heightPct = Math.max(Math.min((item.value / maxValue) * 100, 100), 4);
          const barColor = item.color || colors.good;

          const secHeightPct =
            item.secondaryValue != null
              ? Math.max(Math.min((item.secondaryValue / maxValue) * 100, 100), 4)
              : null;

          return (
            <View key={`bar-${index}`} style={styles.barGroup}>
              <View style={styles.barsContainer}>
                {/* Barra Principal */}
                <View style={styles.barWrapper}>
                  <Text style={styles.barValueText}>{Math.round(item.value)}</Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${heightPct}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>

                {/* Barra Secundaria opcional */}
                {secHeightPct != null && (
                  <View style={styles.barWrapper}>
                    <Text style={styles.barValueText}>
                      {Math.round(item.secondaryValue!)}
                    </Text>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${secHeightPct}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              {/* Etiquetas Eje X */}
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
              {item.subLabel ? (
                <Text style={styles.subLabel}>{item.subLabel}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.unitText}>Valores expresados en {unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '68%',
    gap: 5,
  },
  barWrapper: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    width: 22,
  },
  bar: {
    width: 18,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  barValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    marginTop: 6,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  footerRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  unitText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
