export const COLD_BACKEND_TIMEOUT_MS = 45000;
export const FLEET_LIST_ATTEMPTS = 3;
export const FLEET_LIST_RETRY_DELAYS_MS = [2000, 4000];

export const FLEET_SYNC_COPY = {
  connecting: 'Connecting to server…',
  offline: 'Pins saved on this device. Will sync when the server is up.',
  writeFailed: 'Pin saved on this device. Server sync failed.',
  deleteFailed: 'Could not delete pin on the server.',
} as const;

export type FleetSyncStatus = 'idle' | 'connecting' | 'offline';

export function fleetSyncBanner(status: FleetSyncStatus): string {
  if (status === 'connecting') return FLEET_SYNC_COPY.connecting;
  if (status === 'offline') return FLEET_SYNC_COPY.offline;
  return '';
}

export function mergeFleetMarkers<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteIds = new Set(remote.map((m) => m.id));
  const localOnly = local.filter((m) => !remoteIds.has(m.id));
  return [...remote, ...localOnly];
}

export async function retryFleetList<T>(
  load: () => Promise<T>,
  options?: {
    attempts?: number;
    delaysMs?: number[];
    isCancelled?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  const attempts = options?.attempts ?? FLEET_LIST_ATTEMPTS;
  const delays = options?.delaysMs ?? FLEET_LIST_RETRY_DELAYS_MS;
  const sleep = options?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    if (options?.isCancelled?.()) {
      const err = lastError instanceof Error ? lastError : new Error('cancelled');
      throw err;
    }
    try {
      return await load();
    } catch (err) {
      lastError = err;
      if (i >= attempts - 1) break;
      options?.onRetry?.(i + 1);
      const delay = delays[Math.min(i, delays.length - 1)] ?? 0;
      if (delay > 0) await sleep(delay);
    }
  }

  throw lastError;
}
