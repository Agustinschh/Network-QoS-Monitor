import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { CREATE_TABLES_SQL, type MeasurementRecord } from './schema';

let dbInstance: DB | null = null;

export function getDatabase(): DB {
  if (!dbInstance) {
    dbInstance = open({
      name: 'qos_monitor.db',
    });
    // Ejecutar creación de tablas e índices síncronamente en primer acceso
    dbInstance.executeSync(CREATE_TABLES_SQL);
  }
  return dbInstance;
}

export function initDatabase(): void {
  try {
    getDatabase();
    console.log('[DB] Base de datos SQLite inicializada exitosamente.');
  } catch (error) {
    console.error('[DB] Error al inicializar SQLite:', error);
  }
}

export async function insertMeasurement(record: Omit<MeasurementRecord, 'id'>): Promise<number> {
  const db = getDatabase();
  const sql = `
    INSERT INTO measurements (
      session_id, timestamp, latitude, longitude, altitude, accuracy,
      network_type, cellular_generation, operator, signal_dbm, signal_level,
      ping_avg_ms, ping_min_ms, ping_max_ms, jitter_ms, packet_loss_pct,
      download_mbps, upload_mbps, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;

  const params: Scalar[] = [
    record.sessionId,
    record.timestamp,
    record.latitude ?? null,
    record.longitude ?? null,
    record.altitude ?? null,
    record.accuracy ?? null,
    record.networkType,
    record.cellularGeneration ?? null,
    record.operator ?? null,
    record.signalDbm ?? null,
    record.signalLevel ?? null,
    record.pingAvgMs ?? null,
    record.pingMinMs ?? null,
    record.pingMaxMs ?? null,
    record.jitterMs ?? null,
    record.packetLossPct ?? null,
    record.downloadMbps ?? null,
    record.uploadMbps ?? null,
    record.notes ?? null,
  ];

  const result = await db.execute(sql, params);
  return result.insertId ?? 0;
}

export interface QueryFilters {
  networkType?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  limit?: number;
  offset?: number;
}

export async function getMeasurements(filters: QueryFilters = {}): Promise<MeasurementRecord[]> {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: Scalar[] = [];

  if (filters.networkType && filters.networkType !== 'ALL') {
    conditions.push('network_type = ?');
    params.push(filters.networkType);
  }

  if (filters.fromTimestamp) {
    conditions.push('timestamp >= ?');
    params.push(filters.fromTimestamp);
  }

  if (filters.toTimestamp) {
    conditions.push('timestamp <= ?');
    params.push(filters.toTimestamp);
  }

  if (
    filters.minLat !== undefined &&
    filters.maxLat !== undefined &&
    filters.minLng !== undefined &&
    filters.maxLng !== undefined
  ) {
    conditions.push('latitude BETWEEN ? AND ?');
    params.push(filters.minLat, filters.maxLat);
    conditions.push('longitude BETWEEN ? AND ?');
    params.push(filters.minLng, filters.maxLng);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = `LIMIT ${filters.limit ?? 100} OFFSET ${filters.offset ?? 0}`;

  const sql = `SELECT * FROM measurements ${whereClause} ORDER BY timestamp DESC ${limitClause};`;
  const result = await db.execute(sql, params);

  if (!result.rows || !Array.isArray(result.rows)) {
    return [];
  }

  return result.rows.map((row: Record<string, any>): MeasurementRecord => ({
    id: row.id as number,
    sessionId: row.session_id as string,
    timestamp: row.timestamp as number,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    altitude: row.altitude as number | null,
    accuracy: row.accuracy as number | null,
    networkType: row.network_type as string,
    cellularGeneration: row.cellular_generation as string | null,
    operator: row.operator as string | null,
    signalDbm: row.signal_dbm as number | null,
    signalLevel: row.signal_level as number | null,
    pingAvgMs: row.ping_avg_ms as number | null,
    pingMinMs: row.ping_min_ms as number | null,
    pingMaxMs: row.ping_max_ms as number | null,
    jitterMs: row.jitter_ms as number | null,
    packetLossPct: row.packet_loss_pct as number | null,
    downloadMbps: row.download_mbps as number | null,
    uploadMbps: row.upload_mbps as number | null,
    notes: row.notes as string | null,
  }));
}

export async function getAllMeasurementsForHeatmap(): Promise<
  Array<{
    latitude: number;
    longitude: number;
    weight: number;
  }>
> {
  const db = getDatabase();
  const sql = `
    SELECT latitude, longitude, download_mbps, signal_level
    FROM measurements
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT 500;
  `;
  const result = await db.execute(sql);
  if (!result.rows || !Array.isArray(result.rows)) {
    return [];
  }

  return result.rows.map((row: Record<string, any>) => {
    const mbps = (row.download_mbps as number) || 0;
    const weight = Math.min(Math.max(mbps / 50, 0.2), 1.0);
    return {
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      weight,
    };
  });
}

export async function deleteMeasurement(id: number): Promise<boolean> {
  const db = getDatabase();
  const result = await db.execute('DELETE FROM measurements WHERE id = ?;', [id]);
  return (result.rowsAffected ?? 0) > 0;
}

export async function clearAllMeasurements(): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM measurements;');
}

export async function countMeasurements(): Promise<number> {
  const db = getDatabase();
  const result = await db.execute('SELECT COUNT(*) as count FROM measurements;');
  if (result.rows && result.rows.length > 0) {
    return Number(result.rows[0].count) || 0;
  }
  return 0;
}
