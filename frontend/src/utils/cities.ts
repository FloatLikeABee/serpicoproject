/** US cities the Fleet map can jump to. */

export interface FleetCity {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const FLEET_CITIES: FleetCity[] = [
  { id: 'olathe', name: 'Olathe', state: 'KS', lat: 38.8814, lng: -94.8191, zoom: 13 },
  { id: 'kansas-city', name: 'Kansas City', state: 'MO', lat: 39.0997, lng: -94.5783, zoom: 12 },
  { id: 'wichita', name: 'Wichita', state: 'KS', lat: 37.6872, lng: -97.3301, zoom: 12 },
  { id: 'chicago', name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, zoom: 12 },
  { id: 'new-york', name: 'New York', state: 'NY', lat: 40.7128, lng: -74.006, zoom: 12 },
  { id: 'los-angeles', name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, zoom: 11 },
  { id: 'houston', name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, zoom: 11 },
  { id: 'phoenix', name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.074, zoom: 11 },
  { id: 'philadelphia', name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, zoom: 12 },
  { id: 'san-antonio', name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936, zoom: 12 },
  { id: 'san-diego', name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, zoom: 12 },
  { id: 'dallas', name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.797, zoom: 12 },
  { id: 'austin', name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, zoom: 12 },
  { id: 'denver', name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, zoom: 12 },
  { id: 'seattle', name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, zoom: 12 },
  { id: 'miami', name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, zoom: 12 },
  { id: 'atlanta', name: 'Atlanta', state: 'GA', lat: 33.749, lng: -84.388, zoom: 12 },
  { id: 'boston', name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, zoom: 13 },
  { id: 'detroit', name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458, zoom: 12 },
  { id: 'minneapolis', name: 'Minneapolis', state: 'MN', lat: 44.9778, lng: -93.265, zoom: 12 },
  { id: 'st-louis', name: 'St. Louis', state: 'MO', lat: 38.627, lng: -90.1994, zoom: 12 },
  { id: 'las-vegas', name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, zoom: 12 },
  { id: 'portland', name: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784, zoom: 12 },
  { id: 'washington', name: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369, zoom: 12 },
];

export const DEFAULT_FLEET_CITY_ID = 'olathe';

export function fleetCityById(id: string): FleetCity {
  return FLEET_CITIES.find((c) => c.id === id) || FLEET_CITIES[0];
}

export function cityLabel(city: FleetCity): string {
  return `${city.name}, ${city.state}`;
}

const cityStorageKey = (userId: string) => `serpico.fleet.city.v1.${userId || 'guest'}`;

export function loadFleetCityId(userId: string): string {
  try {
    const saved = localStorage.getItem(cityStorageKey(userId));
    if (saved && FLEET_CITIES.some((c) => c.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_FLEET_CITY_ID;
}

export function saveFleetCityId(userId: string, cityId: string) {
  try {
    localStorage.setItem(cityStorageKey(userId), cityId);
  } catch (err) {
    console.warn('saveFleetCityId failed', err);
  }
}
