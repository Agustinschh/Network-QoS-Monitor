import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme';
import { getMeasurements } from '../../database/db';
import type { MeasurementRecord } from '../../database/schema';
import { LocationService } from '../../core/geo/LocationService';

export function MapCoverageScreen() {
  const webViewRef = useRef<any>(null);
  const carouselRef = useRef<FlatList>(null);
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricMode, setMetricMode] = useState<'mbps' | 'dbm'>('mbps');
  const [viewMode, setViewMode] = useState<'both' | 'heatmap' | 'markers'>('both');
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getMeasurements({ limit: 200 });
      setMeasurements(list);
    } catch (e) {
      console.warn('[MapCoverageScreen] Error cargando mediciones:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrar solo las mediciones con GPS válido
  const validPoints = useMemo(
    () => measurements.filter(m => m.latitude != null && m.longitude != null),
    [measurements],
  );

  const handleSelectPoint = (m: MeasurementRecord) => {
    setSelectedPointId(m.id ?? null);
    if (m.latitude != null && m.longitude != null && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.panTo === 'function') {
          window.panTo(${m.latitude}, ${m.longitude});
        }
        true;
      `);
    }
  };

  const handleCenterOnUser = async () => {
    const loc = await LocationService.getCurrentLocation();
    if (loc && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.panTo === 'function') {
          window.panTo(${loc.latitude}, ${loc.longitude});
        }
        true;
      `);
    }
  };

  const getMarkerColor = (m: MeasurementRecord): string => {
    if (metricMode === 'mbps') {
      const mbps = m.downloadMbps || 0;
      if (mbps >= 25) return colors.good;
      if (mbps >= 10) return colors.fair;
      return colors.poor;
    } else {
      const dbm = m.signalDbm ?? -110;
      if (dbm >= -85) return colors.good;
      if (dbm >= -105) return colors.fair;
      return colors.poor;
    }
  };

  // Generar HTML dinámico de Leaflet con tema CartoDB Dark Matter
  const mapHtml = useMemo(() => {
    const initialLat = validPoints[0]?.latitude ?? 37.422;
    const initialLon = validPoints[0]?.longitude ?? -122.084;

    const pointsData = validPoints.map((p, idx) => {
      // Dispersión sutil en abanico si las coordenadas son idénticas para evitar solapamiento
      const angle = (idx / Math.max(1, validPoints.length)) * 2 * Math.PI;
      const dist = idx === 0 ? 0 : 0.0006;
      const lat = (p.latitude ?? 37.422) + Math.sin(angle) * dist;
      const lon = (p.longitude ?? -122.084) + Math.cos(angle) * dist;

      let color = '#10b981';
      let weight = 0.5;
      if (metricMode === 'mbps') {
        const mbps = p.downloadMbps || 0;
        if (mbps >= 25) color = '#10b981';
        else if (mbps >= 10) color = '#f59e0b';
        else color = '#ef4444';
        weight = Math.min(Math.max(mbps / 40, 0.2), 1.0);
      } else {
        const dbm = p.signalDbm ?? -110;
        if (dbm >= -85) color = '#10b981';
        else if (dbm >= -105) color = '#f59e0b';
        else color = '#ef4444';
        weight = Math.min(Math.max((dbm + 120) / 60, 0.2), 1.0);
      }

      const label =
        metricMode === 'mbps'
          ? `${p.downloadMbps != null ? p.downloadMbps.toFixed(1) : '—'} M`
          : `${p.signalDbm ?? '—'} d`;

      return {
        id: p.id,
        lat,
        lon,
        color,
        label,
        weight,
        downloadMbps: p.downloadMbps,
        uploadMbps: p.uploadMbps,
        pingAvgMs: p.pingAvgMs,
        jitterMs: p.jitterMs,
        signalDbm: p.signalDbm,
        operator: p.operator || 'Operador',
        tech: p.cellularGeneration || (p.networkType === 'cellular' ? 'Móvil' : 'Wi-Fi'),
        time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { height: 100%; width: 100%; background: #0b0f1a; font-family: -apple-system, sans-serif; overflow: hidden; }
    .custom-pill {
      background: rgba(20, 26, 42, 0.95);
      border: 1.5px solid #3b82f6;
      border-radius: 20px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      transform: translate(-50%, -50%);
      cursor: pointer;
    }
    .custom-pill.selected {
      border-color: #60a5fa !important;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.4), 0 6px 16px rgba(0,0,0,0.8);
      transform: translate(-50%, -50%) scale(1.1);
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .leaflet-popup-content-wrapper {
      background: #141a2a;
      color: #f1f5f9;
      border-radius: 12px;
      border: 1px solid #26304a;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8);
      padding: 0;
    }
    .leaflet-popup-content {
      margin: 12px 14px;
      line-height: 1.4;
      font-size: 12px;
    }
    .leaflet-popup-tip {
      background: #141a2a;
    }
    .popup-title {
      font-weight: 700;
      color: #38bdf8;
      font-size: 13px;
      margin-bottom: 6px;
      border-bottom: 1px solid #26304a;
      padding-bottom: 4px;
    }
    .popup-row {
      display: flex;
      justify-content: space-between;
      margin-top: 3px;
      color: #94a3b8;
    }
    .popup-val {
      font-weight: 600;
      color: #f1f5f9;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const points = ${JSON.stringify(pointsData)};
    const viewMode = "${viewMode}";
    const selectedId = ${selectedPointId ?? 'null'};

    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
    }).setView([${initialLat}, ${initialLon}], 15);

    // Capa base oscura gratuita y sin requerimiento de API Key (Esri Dark Canvas)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 16,
      maxZoom: 19,
    }).addTo(map);

    // Capa de nombres de calles y etiquetas de referencia sobre el mapa oscuro
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 16,
      maxZoom: 19,
    }).addTo(map);

    // Heatmap Overlay (RF-05)
    if (viewMode === 'both' || viewMode === 'heatmap') {
      const heatData = points.map(p => [p.lat, p.lon, p.weight]);
      if (heatData.length > 0) {
        L.heatLayer(heatData, {
          radius: 38,
          blur: 24,
          maxZoom: 18,
          gradient: { 0.2: '#ef4444', 0.6: '#f59e0b', 1.0: '#10b981' }
        }).addTo(map);
      }
    }

    // Marcadores Interactivos (Pins)
    if (viewMode === 'both' || viewMode === 'markers') {
      points.forEach(p => {
        const isSel = selectedId === p.id;
        const icon = L.divIcon({
          className: '',
          html: '<div class="custom-pill ' + (isSel ? 'selected' : '') + '" style="border-color:' + p.color + ';">' +
                '<span class="dot" style="background:' + p.color + ';"></span>' +
                '<span>' + p.label + '</span>' +
                '</div>',
          iconSize: [60, 24],
          iconAnchor: [30, 12]
        });

        const marker = L.marker([p.lat, p.lon], { icon }).addTo(map);

        const popupHtml = '<div class="popup-title">' + p.tech + ' — ' + p.operator + '</div>' +
          '<div class="popup-row"><span>⬇ Descarga:</span><span class="popup-val" style="color:#10b981;">' + (p.downloadMbps != null ? p.downloadMbps.toFixed(1) + ' Mbps' : '—') + '</span></div>' +
          '<div class="popup-row"><span>⬆ Subida:</span><span class="popup-val" style="color:#3b82f6;">' + (p.uploadMbps != null ? p.uploadMbps.toFixed(1) + ' Mbps' : '—') + '</span></div>' +
          '<div class="popup-row"><span>⏱ Latencia RTT:</span><span class="popup-val">' + (p.pingAvgMs != null ? p.pingAvgMs + ' ms' : '—') + '</span></div>' +
          '<div class="popup-row"><span>📶 Señal:</span><span class="popup-val">' + (p.signalDbm != null ? p.signalDbm + ' dBm' : '—') + '</span></div>' +
          '<div class="popup-row" style="margin-top:6px;font-size:10px;color:#64748b;"><span>Hora:</span><span>' + p.time + '</span></div>';

        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_POINT', id: p.id }));
          }
        });
      });
    }

    window.panTo = function(lat, lon) {
      map.flyTo([lat, lon], 16, { duration: 0.8 });
    };
  </script>
</body>
</html>
    `;
  }, [validPoints, metricMode, viewMode, selectedPointId]);

  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SELECT_POINT') {
        setSelectedPointId(data.id);
        const idx = validPoints.findIndex(p => p.id === data.id);
        if (idx >= 0 && carouselRef.current) {
          carouselRef.current.scrollToIndex({ index: idx, animated: true });
        }
      }
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Barra Superior de Controles */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mapa de Cobertura QoS</Text>
          <Text style={styles.headerSubtitle}>
            {validPoints.length} puntos georreferenciados (RF-05)
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Text style={styles.refreshBtnText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Selectores de Visualización */}
      <View style={styles.toolbar}>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, metricMode === 'mbps' && styles.toggleBtnActive]}
            onPress={() => setMetricMode('mbps')}>
            <Text
              style={[
                styles.toggleText,
                metricMode === 'mbps' && styles.toggleTextActive,
              ]}>
              ⚡ Velocidad (Mbps)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, metricMode === 'dbm' && styles.toggleBtnActive]}
            onPress={() => setMetricMode('dbm')}>
            <Text
              style={[
                styles.toggleText,
                metricMode === 'dbm' && styles.toggleTextActive,
              ]}>
              📶 Señal (dBm)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.viewModeGroup}>
          {(['both', 'heatmap', 'markers'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.modePill, viewMode === mode && styles.modePillActive]}
              onPress={() => setViewMode(mode)}>
              <Text
                style={[
                  styles.modePillText,
                  viewMode === mode && styles.modePillTextActive,
                ]}>
                {mode === 'both' ? 'Todos' : mode === 'heatmap' ? 'Heatmap' : 'Pins'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Mapa Interactivo con CartoDB Dark Matter */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={StyleSheet.absoluteFill}
          originWhitelist={['*']}
          onMessage={onWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {/* Botón flotante para centrar en GPS */}
        <TouchableOpacity style={styles.gpsFab} onPress={handleCenterOnUser}>
          <Text style={styles.gpsFabIcon}>🎯</Text>
        </TouchableOpacity>

        {/* Carrusel interactivo de puntos georreferenciados (RF-05) */}
        {validPoints.length > 0 && (
          <View style={styles.carouselContainer}>
            <FlatList
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              data={validPoints}
              keyExtractor={item => `card-${item.id}`}
              contentContainerStyle={styles.carouselList}
              renderItem={({ item }) => {
                const isSelected = selectedPointId === item.id;
                const markerColor = getMarkerColor(item);
                const isCell = item.networkType === 'cellular';
                return (
                  <TouchableOpacity
                    style={[
                      styles.pointCard,
                      isSelected && styles.pointCardSelected,
                    ]}
                    onPress={() => handleSelectPoint(item)}>
                    <View style={styles.pointCardHeader}>
                      <View style={[styles.statusDot, { backgroundColor: markerColor }]} />
                      <Text style={styles.pointCardTitle}>
                        #{item.id} • {isCell ? (item.cellularGeneration || 'Móvil') : 'Wi-Fi'}
                      </Text>
                      <Text style={styles.pointCardOperator} numberOfLines={1}>
                        {item.operator || 'Operador'}
                      </Text>
                    </View>

                    <View style={styles.pointCardStats}>
                      <Text style={styles.pointCardStat}>
                        ⬇ <Text style={{ color: colors.good, fontWeight: '700' }}>{item.downloadMbps?.toFixed(1) ?? '—'}</Text> M
                      </Text>
                      <Text style={styles.pointCardStat}>
                        ⬆ <Text style={{ color: colors.primary, fontWeight: '700' }}>{item.uploadMbps?.toFixed(1) ?? '—'}</Text> M
                      </Text>
                      <Text style={styles.pointCardStat}>
                        📶 <Text style={{ color: colors.text, fontWeight: '600' }}>{item.signalDbm ?? '—'}</Text> dBm
                      </Text>
                    </View>

                    <Text style={styles.pointCardCoords}>
                      📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* Leyenda de Calidad en la parte inferior */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Escala de Calidad</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: colors.good }]} />
              <Text style={styles.legendItemText}>
                {metricMode === 'mbps' ? '≥ 25 Mbps' : '≥ -85 dBm (Excelente)'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: colors.fair }]} />
              <Text style={styles.legendItemText}>
                {metricMode === 'mbps' ? '10-25 Mbps' : '-85 a -105 dBm (Aceptable)'}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: colors.poor }]} />
              <Text style={styles.legendItemText}>
                {metricMode === 'mbps' ? '< 10 Mbps' : '< -105 dBm (Pobre)'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: {
    fontSize: 16,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: '#fff',
  },
  viewModeGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  modePill: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modePillActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modePillTextActive: {
    color: colors.primary,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0b0f1a',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 15, 26, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  gpsFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 5,
  },
  gpsFabIcon: {
    fontSize: 20,
  },
  carouselContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  carouselList: {
    paddingHorizontal: 14,
    gap: 10,
  },
  pointCard: {
    width: 210,
    backgroundColor: 'rgba(20, 26, 42, 0.94)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  pointCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(30, 41, 69, 0.98)',
  },
  pointCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pointCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  pointCardOperator: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  pointCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pointCardStat: {
    fontSize: 11,
    color: colors.textMuted,
  },
  pointCardCoords: {
    fontSize: 10,
    color: colors.textMuted,
  },
  legendCard: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(20, 26, 42, 0.92)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 5,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendItemText: {
    fontSize: 10,
    color: colors.text,
  },
});
