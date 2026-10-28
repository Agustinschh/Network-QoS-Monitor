export interface ThroughputProgress {
  phase: 'idle' | 'download' | 'upload' | 'completed' | 'error';
  currentMbps: number;
  progressPct: number;
  transferredBytes: number;
  totalBytes: number;
  durationMs: number;
}

export interface ThroughputResult {
  downloadMbps: number;
  uploadMbps: number;
  downloadDurationMs: number;
  uploadDurationMs: number;
  downloadBytes: number;
  uploadBytes: number;
  serverReportedMbps?: number;
  timestamp: number;
}

export const DEFAULT_BACKEND_URL = 'http://10.0.2.2:3000';

const getTimeMs = (): number => Date.now();

/**
 * Ejecuta el test de velocidad de bajada (Download Throughput).
 * Lee un flujo de bytes aleatorios desde el backend calculando la tasa en Mbps en tiempo real.
 */
export function runDownloadTest(
  backendUrl = DEFAULT_BACKEND_URL,
  sizeInMb = 5,
  onProgress?: (p: ThroughputProgress) => void,
): Promise<{ mbps: number; durationMs: number; totalBytes: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${backendUrl}/api/download?sizeInMb=${sizeInMb}`;
    const startTime = getTimeMs();
    let lastProgressTime = startTime;

    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');

    xhr.onprogress = event => {
      const now = getTimeMs();
      const elapsedSec = (now - startTime) / 1000;
      if (elapsedSec > 0.05) {
        const currentMbps = (event.loaded * 8) / elapsedSec / 1e6;
        const total = event.total > 0 ? event.total : sizeInMb * 1024 * 1024;
        const pct = Math.min(100, Math.round((event.loaded / total) * 100));

        if (now - lastProgressTime > 80) {
          lastProgressTime = now;
          onProgress?.({
            phase: 'download',
            currentMbps: Number(currentMbps.toFixed(2)),
            progressPct: pct,
            transferredBytes: event.loaded,
            totalBytes: total,
            durationMs: Math.round(now - startTime),
          });
        }
      }
    };

    xhr.onload = () => {
      const durationMs = Math.max(1, getTimeMs() - startTime);
      const totalBytes = xhr.response?.byteLength || sizeInMb * 1024 * 1024;
      const mbps = (totalBytes * 8) / (durationMs / 1000) / 1e6;

      onProgress?.({
        phase: 'download',
        currentMbps: Number(mbps.toFixed(2)),
        progressPct: 100,
        transferredBytes: totalBytes,
        totalBytes,
        durationMs: Math.round(durationMs),
      });

      resolve({
        mbps: Number(mbps.toFixed(2)),
        durationMs: Math.round(durationMs),
        totalBytes,
      });
    };

    xhr.onerror = () => {
      reject(new Error(`Error de conexión con el backend (${url})`));
    };

    xhr.ontimeout = () => {
      reject(new Error('Timeout durante el test de descarga'));
    };

    xhr.timeout = 30000;
    xhr.send();
  });
}

/**
 * Genera un buffer de bytes aleatorios en memoria para el test de subida.
 */
function createUploadPayload(sizeInMb: number): Uint8Array {
  const bytes = Math.round(sizeInMb * 1024 * 1024);
  const buffer = new Uint8Array(bytes);
  // Relleno ultra-rápido en C++ nativo sin bucles JS
  buffer.fill(0x5a);
  return buffer;
}

/**
 * Ejecuta el test de velocidad de subida (Upload Throughput).
 * Transmite un payload binario hacia el endpoint POST /api/upload.
 */
export function runUploadTest(
  backendUrl = DEFAULT_BACKEND_URL,
  sizeInMb = 0.5,
  onProgress?: (p: ThroughputProgress) => void,
): Promise<{ mbps: number; durationMs: number; totalBytes: number; serverMbps?: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${backendUrl}/api/upload`;
    const payload = createUploadPayload(sizeInMb);
    const totalBytes = payload.byteLength;
    const startTime = getTimeMs();
    let lastProgressTime = startTime;
    let lastTransferredBytes = 0;

    // Notificar inicio inmediato de la fase de subida
    onProgress?.({
      phase: 'upload',
      currentMbps: 0,
      progressPct: 0,
      transferredBytes: 0,
      totalBytes,
      durationMs: 0,
    });

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    if (xhr.upload) {
      xhr.upload.onprogress = event => {
        const now = getTimeMs();
        lastTransferredBytes = event.loaded;
        const elapsedSec = (now - startTime) / 1000;
        if (elapsedSec > 0.05) {
          const currentMbps = (event.loaded * 8) / elapsedSec / 1e6;
          const pct = Math.min(100, Math.round((event.loaded / totalBytes) * 100));

          if (now - lastProgressTime > 60 || pct === 100) {
            lastProgressTime = now;
            onProgress?.({
              phase: 'upload',
              currentMbps: Number(currentMbps.toFixed(2)),
              progressPct: pct,
              transferredBytes: event.loaded,
              totalBytes,
              durationMs: Math.round(now - startTime),
            });
          }
        }
      };
    }

    xhr.onload = () => {
      const durationMs = Math.max(1, getTimeMs() - startTime);
      const clientMbps = (totalBytes * 8) / (durationMs / 1000) / 1e6;
      let serverMbps: number | undefined;

      try {
        const json = JSON.parse(xhr.responseText);
        serverMbps = json.serverMbps;
      } catch {}

      onProgress?.({
        phase: 'upload',
        currentMbps: Number(clientMbps.toFixed(2)),
        progressPct: 100,
        transferredBytes: totalBytes,
        totalBytes,
        durationMs: Math.round(durationMs),
      });

      resolve({
        mbps: Number(clientMbps.toFixed(2)),
        durationMs: Math.round(durationMs),
        totalBytes,
        serverMbps,
      });
    };

    xhr.onerror = (e) => {
      console.warn(`[ThroughputEngine] Error o interrupción en upload:`, e);
      const durationMs = Math.max(1, getTimeMs() - startTime);
      if (lastTransferredBytes > 50 * 1024) {
        // Si ya se transmitió una muestra significativa, calcular throughput efectivo
        const fallbackMbps = (lastTransferredBytes * 8) / (durationMs / 1000) / 1e6;
        resolve({
          mbps: Number(fallbackMbps.toFixed(2)),
          durationMs: Math.round(durationMs),
          totalBytes: lastTransferredBytes,
        });
      } else {
        reject(new Error(`Error enviando datos al servidor (${url})`));
      }
    };

    xhr.ontimeout = () => {
      const durationMs = Math.max(1, getTimeMs() - startTime);
      if (lastTransferredBytes > 50 * 1024) {
        const fallbackMbps = (lastTransferredBytes * 8) / (durationMs / 1000) / 1e6;
        resolve({
          mbps: Number(fallbackMbps.toFixed(2)),
          durationMs: Math.round(durationMs),
          totalBytes: lastTransferredBytes,
        });
      } else {
        reject(new Error('Timeout durante el test de subida'));
      }
    };

    xhr.timeout = 60000; // 60 segundos de margen amplio
    xhr.send(payload);
  });
}

/**
 * Ejecuta la suite completa de Throughput (Descarga seguida de Subida).
 * Cumple con RF-03.
 */
export async function runFullThroughputSuite(
  backendUrl = DEFAULT_BACKEND_URL,
  downloadSizeMb = 3,
  uploadSizeMb = 0.5,
  onProgress?: (p: ThroughputProgress) => void,
): Promise<ThroughputResult> {
  const dl = await runDownloadTest(backendUrl, downloadSizeMb, onProgress);
  await new Promise<void>(resolve => setTimeout(resolve, 300));
  const ul = await runUploadTest(backendUrl, uploadSizeMb, onProgress);

  return {
    downloadMbps: dl.mbps,
    uploadMbps: ul.mbps,
    downloadDurationMs: dl.durationMs,
    uploadDurationMs: ul.durationMs,
    downloadBytes: dl.totalBytes,
    uploadBytes: ul.totalBytes,
    serverReportedMbps: ul.serverMbps,
    timestamp: Date.now(),
  };
}
