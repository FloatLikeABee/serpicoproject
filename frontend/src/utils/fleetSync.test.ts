import {
  COLD_BACKEND_TIMEOUT_MS,
  FLEET_LIST_ATTEMPTS,
  FLEET_SYNC_COPY,
  fleetSyncBanner,
  mergeFleetMarkers,
  retryFleetList,
} from './fleetSync';

const pin = (id: string, name: string) => ({ id, name });

describe('mergeFleetMarkers', () => {
  it('keeps local-only pins when the server list is empty', () => {
    const local = [pin('flt-local', 'Station')];
    expect(mergeFleetMarkers(local, [])).toEqual(local);
  });

  it('lets the server version win when the same id exists locally', () => {
    const local = [pin('flt-1', 'Old name')];
    const remote = [pin('flt-1', 'Server name')];
    expect(mergeFleetMarkers(local, remote)).toEqual([pin('flt-1', 'Server name')]);
  });

  it('adds server-only pins and keeps local-only pins', () => {
    const local = [pin('flt-local', 'Local')];
    const remote = [pin('flt-remote', 'Remote')];
    expect(mergeFleetMarkers(local, remote)).toEqual([
      pin('flt-remote', 'Remote'),
      pin('flt-local', 'Local'),
    ]);
  });
});

describe('retryFleetList', () => {
  it('retries after failure and returns the later success', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const result = await retryFleetList(
      async () => {
        attempts += 1;
        if (attempts < 2) throw new Error('timeout');
        return { markers: [pin('flt-1', 'Station')] };
      },
      {
        sleep: async (ms) => {
          delays.push(ms);
        },
      }
    );

    expect(attempts).toBe(2);
    expect(delays).toEqual([2000]);
    expect(result.markers).toHaveLength(1);
  });

  it('throws after three failed attempts', async () => {
    let attempts = 0;
    await expect(
      retryFleetList(
        async () => {
          attempts += 1;
          throw new Error('down');
        },
        { sleep: async () => undefined }
      )
    ).rejects.toThrow('down');
    expect(attempts).toBe(FLEET_LIST_ATTEMPTS);
  });

  it('calls onRetry after a miss when more attempts remain', async () => {
    const retried: number[] = [];
    let attempts = 0;
    await retryFleetList(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('miss');
        return [];
      },
      {
        sleep: async () => undefined,
        onRetry: (attempt) => retried.push(attempt),
      }
    );
    expect(retried).toEqual([1, 2]);
  });
});

describe('fleetSyncBanner', () => {
  it('does not show a hard outage on idle', () => {
    expect(fleetSyncBanner('idle')).toBe('');
  });

  it('shows connecting copy while retrying', () => {
    expect(fleetSyncBanner('connecting')).toBe('Connecting to server…');
    expect(FLEET_SYNC_COPY.connecting).toBe('Connecting to server…');
  });

  it('shows on-device copy after retries are exhausted', () => {
    expect(fleetSyncBanner('offline')).toBe(
      'Pins saved on this device. Will sync when the server is up.'
    );
    expect(fleetSyncBanner('offline')).not.toMatch(/unavailable/i);
  });

  it('uses the same cold-start budget as the app health check', () => {
    expect(COLD_BACKEND_TIMEOUT_MS).toBe(45000);
  });
});
