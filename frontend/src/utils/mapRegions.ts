import type { Nation } from './nation';
import {
  OLATHE_BOUNDS,
  OLATHE_CENTER,
  OLATHE_MAX_ZOOM,
  OLATHE_MIN_ZOOM,
} from './pursuitSim';

export const SHANGHAI_CENTER: [number, number] = [31.2304, 121.4737];
export const SHANGHAI_BOUNDS = {
  latMin: 31.05,
  latMax: 31.45,
  lngMin: 121.20,
  lngMax: 121.80,
};

export type MapRegion = {
  center: [number, number];
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number };
  minZoom: number;
  maxZoom: number;
};

export function pursueMapRegion(nation: Nation): MapRegion {
  if (nation === 'cn') {
    return {
      center: SHANGHAI_CENTER,
      bounds: SHANGHAI_BOUNDS,
      minZoom: 11,
      maxZoom: 17,
    };
  }
  return {
    center: OLATHE_CENTER,
    bounds: OLATHE_BOUNDS,
    minZoom: OLATHE_MIN_ZOOM,
    maxZoom: OLATHE_MAX_ZOOM,
  };
}
