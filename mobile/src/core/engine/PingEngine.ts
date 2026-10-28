import TcpSocket from 'react-native-tcp-socket';

export interface PingHostConfig {
  id: string;
  name: string;
  host: string;
  port: number;
}

export interface PingHostResult {
  hostId: string;
  name: string;
  host: string;
  port: number;
  rttMin: number;
  rttAvg: number;
  rttMax: number;
  jitter: number;
  packetLossPct: number;
  samples: number[];
}

export interface PingSuiteResult {
  results: PingHostResult[];
  overallAvgRtt: number;
  overallJitter: number;
  timestamp: number;
}

export const DEFAULT_PING_HOSTS: PingHostConfig[] = [
  { id: 'cloudflare', name: 'Cloudflare DNS', host: '1.1.1.1', port: 80 },
  { id: 'google', name: 'Google DNS', host: '8.8.8.8', port: 53 },
  { id: 'backend', name: 'Servidor QoS Ref', host: '10.0.2.2', port: 3000 },
];

const getTimeMs = (): number => Date.now();

/**
 * Mide un único RTT abriendo una conexión TCP contra host:port.
 * Retorna el tiempo en ms o null si hubo timeout / error.
 */
function probeSingleTcp(host: string, port: number, timeoutMs = 2500): Promise<number | null> {
  return new Promise(resolve => {
    const startTime = getTimeMs();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          socket.destroy();
        } catch {}
        resolve(null);
      }
    }, timeoutMs);

    let socket: any;
    try {
      socket = TcpSocket.createConnection({ host, port }, () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          const rtt = Math.max(1, Math.round(getTimeMs() - startTime));
          try {
            socket.destroy();
          } catch {}
          resolve(rtt);
        }
      });

      socket.on('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            socket.destroy();
          } catch {}
          resolve(null);
        }
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Calcula jitter estadístico bajo RFC 3550 a partir de muestras consecutivas de RTT.
 * J(i) = J(i-1) + (|D(i-1, i)| - J(i-1)) / 16
 */
function calculateJitterRfc3550(samples: number[]): number {
  if (samples.length < 2) return 0;
  let jitter = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = Math.abs(samples[i] - samples[i - 1]);
    jitter = jitter + (d - jitter) / 16;
  }
  return Math.round(jitter * 10) / 10;
}

/**
 * Orquesta una batería de pings sobre sockets TCP para al menos 3 hosts configurables.
 * Cumple estrictamente con RF-02.
 */
export async function runPingSuite(
  hosts: PingHostConfig[] = DEFAULT_PING_HOSTS,
  probesPerHost = 5,
  onProgress?: (hostName: string, probeIndex: number, totalProbes: number, currentRtt: number | null) => void,
): Promise<PingSuiteResult> {
  const hostResults: PingHostResult[] = [];

  for (const target of hosts) {
    const samples: number[] = [];
    let failedProbes = 0;

    for (let i = 0; i < probesPerHost; i++) {
      const rtt = await probeSingleTcp(target.host, target.port);
      if (rtt != null) {
        samples.push(rtt);
      } else {
        failedProbes++;
      }

      onProgress?.(target.name, i + 1, probesPerHost, rtt);

      // Pequeña pausa entre sondas para no saturar la red ni bloquear el hilo
      await new Promise<void>(resolve => setTimeout(resolve, 120));
    }

    const successful = samples.length;
    const rttMin = successful > 0 ? Math.min(...samples) : 0;
    const rttMax = successful > 0 ? Math.max(...samples) : 0;
    const rttAvg = successful > 0 ? Math.round(samples.reduce((a, b) => a + b, 0) / successful) : 0;
    const jitter = calculateJitterRfc3550(samples);
    const packetLossPct = Math.round((failedProbes / probesPerHost) * 100);

    hostResults.push({
      hostId: target.id,
      name: target.name,
      host: target.host,
      port: target.port,
      rttMin,
      rttAvg,
      rttMax,
      jitter,
      packetLossPct,
      samples,
    });
  }

  const validAvgs = hostResults.filter(h => h.rttAvg > 0).map(h => h.rttAvg);
  const overallAvgRtt = validAvgs.length > 0 ? Math.round(validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) : 0;
  const overallJitter =
    hostResults.length > 0
      ? Math.round((hostResults.reduce((a, b) => a + b.jitter, 0) / hostResults.length) * 10) / 10
      : 0;

  return {
    results: hostResults,
    overallAvgRtt,
    overallJitter,
    timestamp: Date.now(),
  };
}
