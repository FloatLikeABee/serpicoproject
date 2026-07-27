import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../contexts/AuthContext';
import InPursue from './InPursue';
import { MAX_DRIVE_ORDER_M, OLATHE_BOUNDS, ensureRoadNetwork } from '../../utils/pursuitSim';
import type { PursuitMapVehicle } from '../../components/PursuitMapCanvas';

const STEP_DEG = 0.0025;

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
            // ~220 m north along a street of the synthetic grid.
            props.onMapClick?.(cop.lat + 0.002, cop.lng);
          }}
        />
        <button
          type="button"
          aria-label="tap open field"
          onClick={() => {
            const cop = props.vehicles.find((v) => v.id === props.driveOrderPoliceId);
            if (!cop) return;
            props.onMapClick?.(cop.lat + STEP_DEG / 2, cop.lng + STEP_DEG / 2);
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

    expect(screen.getByText(new RegExp(`${MAX_DRIVE_ORDER_M} m per order`))).toBeInTheDocument();
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
