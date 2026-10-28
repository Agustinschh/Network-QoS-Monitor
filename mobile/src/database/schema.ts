export interface MeasurementRecord {
  id?: number;
  sessionId: string;
  timestamp: number; // Unix timestamp in ms
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  networkType: string; // 'wifi' | 'cellular' | 'none' | 'unknown'
  cellularGeneration: string | null; // '2G' | '3G' | '4G' | '5G'
  operator: string | null;
  signalDbm: number | null;
  signalLevel: number | null; // 0..4
  pingAvgMs: number | null;
  pingMinMs: number | null;
  pingMaxMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  notes?: string | null;
}

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  latitude REAL,
  longitude REAL,
  altitude REAL,
  accuracy REAL,
  network_type TEXT NOT NULL,
  cellular_generation TEXT,
  operator TEXT,
  signal_dbm REAL,
  signal_level INTEGER,
  ping_avg_ms REAL,
  ping_min_ms REAL,
  ping_max_ms REAL,
  jitter_ms REAL,
  packet_loss_pct REAL,
  download_mbps REAL,
  upload_mbps REAL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_coords ON measurements(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_measurements_network ON measurements(network_type, cellular_generation);
`;
