export interface SearchablePin {
  id: string;
  name: string;
  address?: string;
  notes: string;
  enrichment?: { summary: string };
  kindLabel: string;
  cityId?: string;
  cityLabel?: string;
  lat: number;
  lng: number;
}

function haystack(pin: SearchablePin): string {
  return [pin.name, pin.address, pin.notes, pin.enrichment?.summary, pin.kindLabel]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

export function matchMapPins(query: string, pins: SearchablePin[]): SearchablePin[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pins.filter((pin) => haystack(pin).includes(q));
}

export function planPinFocus(
  currentCityId: string,
  pin: { cityId?: string; lat: number; lng: number }
): { switchCityTo?: string; skipCityCenter: boolean; lat: number; lng: number } {
  const switchCityTo = pin.cityId && pin.cityId !== currentCityId ? pin.cityId : undefined;
  return {
    switchCityTo,
    skipCityCenter: true,
    lat: pin.lat,
    lng: pin.lng,
  };
}
