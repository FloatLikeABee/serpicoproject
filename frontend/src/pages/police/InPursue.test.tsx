import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';
import InPursue from './InPursue';
import {
  MAX_DRIVE_ORDER_M,
  OLATHE_BOUNDS,
  ROAD_TAP_TOLERANCE_M,
  ensureRoadNetwork,
} from '../../utils/pursuitSim';
import { getRoadNetwork, snapToRoadSegment } from '../../utils/olatheRoadNetwork';
import type { PursuitMapVehicle } from '../../components/PursuitMapCanvas';

const STEP_DEG = 0.0025;

function offsetMeters(lat: number, lng: number, meters: number, bearingDeg: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    lat: lat + (meters * Math.cos(rad)) / 111320,
    lng: lng + (meters * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180)),
  };
}

/**
 * The drive ring is only a block wide, so the fixture has to look for a real street inside it
 * rather than assume one lies a fixed distance north. Prefixed `mock` so the jest.mock factory
 * below may reference it.
 */
function mockStreetInRing(lat: number, lng: number) {
  const network = getRoadNetwork();
  if (!network) return null;
  for (let deg = 0; deg < 360; deg += 15) {
    const aim = offsetMeters(lat, lng, MAX_DRIVE_ORDER_M * 0.7, deg);
    const snap = snapToRoadSegment(network, aim);
    if (snap && snap.distM <= 3) return aim;
  }
  return null;
}

/** A spot inside the ring that is clearly off any centerline. */
function mockOpenGroundInRing(lat: number, lng: number) {
  const network = getRoadNetwork();
  if (!network) return null;
  for (const reach of [70, 90, 110]) {
    for (let deg = 0; deg < 360; deg += 15) {
      const aim = offsetMeters(lat, lng, reach, deg);
      const snap = snapToRoadSegment(network, aim);
      if (snap && snap.distM > ROAD_TAP_TOLERANCE_M * 2) return aim;
    }
  }
  return null;
}

function olatheGridResponse() {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (let lat = OLATHE_BOUNDS.latMin; lat <= OLATHE_BOUNDS.latMax; lat += STEP_DEG) lats.push(lat);
  for (let lng = OLATHE_BOUNDS.lngMin; lng <= OLATHE_BOUNDS.lngMax; lng += STEP_DEG) lngs.push(lng);
  return {
    elements: [
      ...lats.map((lat) => ({ type: 'way', geometry: lngs.map((lng) => ({ lat, lon: lng })) })),
      ...lngs.map((lng) => ({ type: 'way', geometry: lats.map((lat) => ({ lat, lon: lng })) })),
    ],
  };
}

/**
 * Leaflet needs a real viewport, so the map is stubbed with the same contract the page uses:
 * a button per vehicle, and one "tap the street" button per exposed drive target.
 */
let lastCanvasProps: {
  vehicles: PursuitMapVehicle[];
  driveOrderPoliceId?: string | null;
  driveOrderRangeM?: number;
} | null = null;

jest.mock('../../components/PursuitMapCanvas', () => ({
  __esModule: true,
  default: (props: {
    vehicles: PursuitMapVehicle[];
    driveOrderPoliceId?: string | null;
    driveOrderRangeM?: number;
    onVehicleClick?: (v: PursuitMapVehicle) => void;
    onMapClick?: (lat: number, lng: number) => void;
  }) => {
    lastCanvasProps = props;
    return (
      <div data-testid="map">
        {props.vehicles.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-label={`unit ${v.role} ${v.id}`}
            onClick={() => props.onVehicleClick?.(v)}
          />
        ))}
        <button
          type="button"
          aria-label="tap street ahead"
          onClick={() => {
            const cop = props.vehicles.find((v) => v.id === props.driveOrderPoliceId);
            if (!cop) return;
            const aim = mockStreetInRing(cop.lat, cop.lng);
            if (aim) props.onMapClick?.(aim.lat, aim.lng);
          }}
        />
        <button
          type="button"
          aria-label="tap open field"
          onClick={() => {
            const cop = props.vehicles.find((v) => v.id === props.driveOrderPoliceId);
            if (!cop) return;
            const aim = mockOpenGroundInRing(cop.lat, cop.lng);
            if (aim) props.onMapClick?.(aim.lat, aim.lng);
          }}
        />
      </div>
    );
  },
}));

async function loadShift() {
  render(
    <AuthProvider>
      <InPursue />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText('Patrol Shift')).toBeInTheDocument());
}

function policeButton(): HTMLElement {
  const cop = lastCanvasProps!.vehicles.find((v) => v.role === 'police')!;
  return screen.getByLabelText(`unit police ${cop.id}`);
}

describe('InPursue patrol page', () => {
  // The mock has to be (re)installed per test: CRA resets mock implementations between tests.
  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => olatheGridResponse(),
    }) as unknown as typeof fetch;
    sessionStorage.clear();
    lastCanvasProps = null;
    await ensureRoadNetwork();
  });

  it('explains the controls while the map loads', async () => {
    render(
      <AuthProvider>
        <InPursue />
      </AuthProvider>
    );
    expect(screen.getByText('How to play')).toBeInTheDocument();
    expect(screen.getByText(/one cruiser/i)).toBeInTheDocument();
    await act(async () => {});
  });

  it('opens with a parked cruiser and a wave at large', async () => {
    await loadShift();
    expect(screen.getByText(/Wave 1 · 5 at large/)).toBeInTheDocument();
    expect(screen.getByText(/Tap your cruiser to take the wheel/)).toBeInTheDocument();
  });

  it('takes the wheel on a cruiser tap and shows the order range', async () => {
    await loadShift();
    fireEvent.click(policeButton());

    expect(screen.getByText(new RegExp(`${MAX_DRIVE_ORDER_M} m hop per tap`))).toBeInTheDocument();
    expect(screen.getByText('Holding position')).toBeInTheDocument();
    expect(lastCanvasProps!.driveOrderPoliceId).toBeTruthy();
    expect(lastCanvasProps!.driveOrderRangeM).toBe(MAX_DRIVE_ORDER_M);
  });

  it('drives on a road tap and can be told to hold again', async () => {
    await loadShift();
    fireEvent.click(policeButton());
    fireEvent.click(screen.getByLabelText('tap street ahead'));

    await waitFor(() => expect(screen.getByText(/Rolling · \d+ m left/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Hold here'));
    await waitFor(() => expect(screen.getByText('Holding position')).toBeInTheDocument());
  });

  it('parks itself at the end of a hop so the next move needs another tap', async () => {
    await loadShift();
    fireEvent.click(policeButton());
    fireEvent.click(screen.getByLabelText('tap street ahead'));

    await waitFor(() => expect(screen.getByText(/Rolling · \d+ m left/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Holding position')).toBeInTheDocument(), {
      timeout: 15000,
    });
  }, 20000);

  it('calls out a refused order instead of moving', async () => {
    await loadShift();
    fireEvent.click(policeButton());
    fireEvent.click(screen.getByLabelText('tap open field'));

    await waitFor(() =>
      expect(screen.getByText(/can only follow streets/i)).toBeInTheDocument()
    );
    expect(screen.getByText('Holding position')).toBeInTheDocument();
  });

  it('marks a suspect so its route can be read off the map', async () => {
    await loadShift();
    const perp = lastCanvasProps!.vehicles.find((v) => v.role === 'perp')!;

    fireEvent.click(screen.getByLabelText(`unit perp ${perp.id}`));
    await act(async () => {});
    expect(lastCanvasProps!.vehicles.length).toBeGreaterThan(1);
  });
});
