import type { Nation } from './nation';

/** Cities the Fleet map can jump to, split by account nation. */

export interface FleetCity {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const US_FLEET_CITIES: FleetCity[] = [
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

export const CN_FLEET_CITIES: FleetCity[] = [
  { id: 'shanghai', name: '上海', state: '沪', lat: 31.2304, lng: 121.4737, zoom: 12 },
  { id: 'beijing', name: '北京', state: '京', lat: 39.9042, lng: 116.4074, zoom: 11 },
  { id: 'guangzhou', name: '广州', state: '粤', lat: 23.1291, lng: 113.2644, zoom: 12 },
  { id: 'shenzhen', name: '深圳', state: '粤', lat: 22.5431, lng: 114.0579, zoom: 12 },
  { id: 'chengdu', name: '成都', state: '川', lat: 30.5728, lng: 104.0668, zoom: 12 },
  { id: 'hangzhou', name: '杭州', state: '浙', lat: 30.2741, lng: 120.1551, zoom: 12 },
  { id: 'wuhan', name: '武汉', state: '鄂', lat: 30.5928, lng: 114.3055, zoom: 12 },
  { id: 'nanjing', name: '南京', state: '苏', lat: 32.0603, lng: 118.7969, zoom: 12 },
  { id: 'tianjin', name: '天津', state: '津', lat: 39.3434, lng: 117.3616, zoom: 12 },
  { id: 'chongqing', name: '重庆', state: '渝', lat: 29.4316, lng: 106.9123, zoom: 11 },
  { id: 'xian', name: '西安', state: '陕', lat: 34.3416, lng: 108.9398, zoom: 12 },
  { id: 'suzhou', name: '苏州', state: '苏', lat: 31.2989, lng: 120.5853, zoom: 12 },
];

/** @deprecated Use fleetCitiesForNation — kept as US pack alias. */
export const FLEET_CITIES = US_FLEET_CITIES;

export const DEFAULT_FLEET_CITY_ID = 'olathe';
export const DEFAULT_CN_FLEET_CITY_ID = 'shanghai';

export function fleetCitiesForNation(nation: Nation): FleetCity[] {
  return nation === 'cn' ? CN_FLEET_CITIES : US_FLEET_CITIES;
}

export function defaultFleetCityId(nation: Nation): string {
  return nation === 'cn' ? DEFAULT_CN_FLEET_CITY_ID : DEFAULT_FLEET_CITY_ID;
}

export function fleetCityById(id: string, nation: Nation = 'us'): FleetCity {
  const pack = fleetCitiesForNation(nation);
  return pack.find((c) => c.id === id) || pack[0];
}

export function cityLabel(city: FleetCity, nation: Nation = 'us'): string {
  if (nation === 'cn') return city.name;
  return `${city.name}, ${city.state}`;
}

const cityStorageKey = (userId: string, nation: Nation) =>
  `serpico.fleet.city.v1.${userId || 'guest'}.${nation}`;

const legacyCityKey = (userId: string) => `serpico.fleet.city.v1.${userId || 'guest'}`;

export function loadFleetCityId(userId: string, nation: Nation = 'us'): string {
  const pack = fleetCitiesForNation(nation);
  const fallback = defaultFleetCityId(nation);
  try {
    const saved = localStorage.getItem(cityStorageKey(userId, nation));
    if (saved && pack.some((c) => c.id === saved)) return saved;
    if (nation === 'us') {
      const legacy = localStorage.getItem(legacyCityKey(userId));
      if (legacy && pack.some((c) => c.id === legacy)) return legacy;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveFleetCityId(userId: string, nation: Nation, cityId: string) {
  try {
    localStorage.setItem(cityStorageKey(userId, nation), cityId);
  } catch (err) {
    console.warn('saveFleetCityId failed', err);
  }
}
