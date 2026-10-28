import { NativeModules, Share, Platform } from 'react-native';
import type { MeasurementRecord } from '../../database/schema';

const { FileExportModule } = NativeModules;

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export class ExportService {
  /**
   * Genera una cadena CSV conforme a RFC 4180 conteniendo todos los parámetros de QoS medidos.
   */
  static generateCsv(records: MeasurementRecord[]): string {
    const headers = [
      'id',
      'session_id',
      'timestamp',
      'iso_date',
      'network_type',
      'cellular_generation',
      'operator',
      'signal_dbm',
      'signal_level',
      'ping_min_ms',
      'ping_avg_ms',
      'ping_max_ms',
      'jitter_ms',
      'packet_loss_pct',
      'download_mbps',
      'upload_mbps',
      'latitude',
      'longitude',
      'altitude',
      'accuracy',
      'notes',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map(r => {
      const isoDate = new Date(r.timestamp).toISOString();
      return [
        escapeCsv(r.id),
        escapeCsv(r.sessionId),
        escapeCsv(r.timestamp),
        escapeCsv(isoDate),
        escapeCsv(r.networkType),
        escapeCsv(r.cellularGeneration ?? ''),
        escapeCsv(r.operator ?? ''),
        escapeCsv(r.signalDbm ?? ''),
        escapeCsv(r.signalLevel ?? ''),
        escapeCsv(r.pingMinMs ?? ''),
        escapeCsv(r.pingAvgMs ?? ''),
        escapeCsv(r.pingMaxMs ?? ''),
        escapeCsv(r.jitterMs ?? ''),
        escapeCsv(r.packetLossPct ?? ''),
        escapeCsv(r.downloadMbps ?? ''),
        escapeCsv(r.uploadMbps ?? ''),
        escapeCsv(r.latitude ?? ''),
        escapeCsv(r.longitude ?? ''),
        escapeCsv(r.altitude ?? ''),
        escapeCsv(r.accuracy ?? ''),
        escapeCsv(r.notes ?? ''),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Genera una cadena JSON estructurada con metadatos y arreglo de mediciones.
   */
  static generateJson(records: MeasurementRecord[]): string {
    const payload = {
      exportMetadata: {
        appName: '01 Network QoS Monitor',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        totalRecords: records.length,
      },
      measurements: records.map(r => ({
        ...r,
        isoDate: new Date(r.timestamp).toISOString(),
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Guarda el archivo exportado en la carpeta pública de Descargas de Android.
   */
  static async saveToDownloads(
    format: 'csv' | 'json',
    records: MeasurementRecord[],
  ): Promise<ExportResult> {
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

      let filename = '';
      let content = '';
      let mimeType = '';

      if (format === 'csv') {
        filename = `qos_mediciones_${timestampStr}.csv`;
        content = this.generateCsv(records);
        mimeType = 'text/csv';
      } else {
        filename = `qos_mediciones_${timestampStr}.json`;
        content = this.generateJson(records);
        mimeType = 'application/json';
      }

      if (Platform.OS === 'android' && FileExportModule?.saveToDownloads) {
        const savedPath = await FileExportModule.saveToDownloads(filename, content, mimeType);
        return { success: true, filePath: savedPath };
      } else {
        // Fallback genérico a Share
        await Share.share({
          title: filename,
          message: content,
        });
        return { success: true, filePath: filename };
      }
    } catch (err: any) {
      console.error('[ExportService] Error exportando archivo:', err);
      return { success: false, error: err?.message || 'Error desconocido al guardar' };
    }
  }

  /**
   * Comparte el contenido a través del diálogo nativo del sistema operativo.
   */
  static async share(format: 'csv' | 'json', records: MeasurementRecord[]): Promise<void> {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    const filename = `qos_export_${timestampStr}.${format}`;
    const content = format === 'csv' ? this.generateCsv(records) : this.generateJson(records);

    await Share.share({
      title: `Exportación QoS (${format.toUpperCase()})`,
      message: content,
    });
  }
}
