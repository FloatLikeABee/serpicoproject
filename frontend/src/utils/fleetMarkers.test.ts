import {
  fleetMarkerFromPayload,
  loadCachedFleetMarkers,
  mergeFleetMarkerLists,
  pickFleetMarkerVersion,
  saveCachedFleetMarkers,
  type FleetMarker,
} from './fleetMarkers';
import { mergePinLocation } from './mapTags';

const base = (over: Partial<FleetMarker> = {}): FleetMarker => ({
  id: 'flt-1',
  kind: 'investigation',
  name: 'Station',
  lat: 38.88,
  lng: -94.81,
  address: '38.88000, -94.81000',
  notes: '',
  cityId: 'olathe',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

describe('mergePinLocation', () => {
  it('keeps typed name and notes when a stale geocode pin arrives', () => {
    const officer = base({
      name: 'Warehouse',
      notes: 'Possible stash.',
      enrichment: { summary: 'AI brief', fetchedAt: '2026-09-02T10:05:00.000Z' },
    });
    const staleGeocode = base({
      name: 'Station',
      notes: '',
      address: '100 E Santa Fe, Olathe, KS',
      updatedAt: '2026-09-02T10:06:00.000Z',
    });
    const merged = mergePinLocation(officer, staleGeocode);
    expect(merged.name).toBe('Warehouse');
    expect(merged.notes).toBe('Possible stash.');
    expect(merged.enrichment?.summary).toBe('AI brief');
    expect(merged.address).toBe('100 E Santa Fe, Olathe, KS');
  });
});

describe('mergeFleetMarkerLists', () => {
  it('keeps richer cache fields when the server list is empty/older', () => {
    const local = base({
      notes: 'Officer notes after AI.',
      name: 'Scene A',
      enrichment: { summary: 'Generated brief.', fetchedAt: '2026-09-02T11:00:00.000Z' },
      updatedAt: '2026-09-02T11:00:00.000Z',
    });
    const remote = base({
      notes: '',
      name: 'Station',
      updatedAt: '2026-09-02T10:00:00.000Z',
    });
    const merged = mergeFleetMarkerLists([local], [remote]);
    expect(merged).toHaveLength(1);
    expect(merged[0].notes).toBe('Officer notes after AI.');
    expect(merged[0].name).toBe('Scene A');
    expect(merged[0].enrichment?.summary).toBe('Generated brief.');
  });

  it('keeps unsynced local-only pins', () => {
    const localOnly = base({ id: 'flt-local', notes: 'Not on server yet.' });
    const remote = base({ id: 'flt-remote', notes: 'From server.' });
    const merged = mergeFleetMarkerLists([localOnly], [remote]);
    const ids = merged.map((m) => m.id).sort();
    expect(ids).toEqual(['flt-local', 'flt-remote']);
  });

  it('round-trips enrichment through cache helpers', () => {
    const pin = base({
      enrichment: { summary: 'Cached AI.', fetchedAt: '2026-09-02T12:00:00.000Z' },
      notes: 'On device.',
    });
    saveCachedFleetMarkers('demo-serpico', [pin]);
    const loaded = loadCachedFleetMarkers('demo-serpico');
    expect(loaded[0].enrichment?.summary).toBe('Cached AI.');
    expect(loaded[0].notes).toBe('On device.');
    const fromPayload = fleetMarkerFromPayload({
      ...pin,
      enrichment: pin.enrichment,
    });
    expect(fromPayload?.enrichment?.summary).toBe('Cached AI.');
    expect(pickFleetMarkerVersion(pin, base({ notes: '' })).notes).toBe('On device.');
  });
});
