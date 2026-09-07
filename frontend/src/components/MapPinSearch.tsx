import React, { useId, useMemo, useState } from 'react';
import { useT } from '../i18n/useT';
import { matchMapPins, type SearchablePin } from '../utils/mapPinSearch';

const RESULT_LIMIT = 8;

interface MapPinSearchProps {
  pins: SearchablePin[];
  onSelect: (pin: SearchablePin) => void;
}

const MapPinSearch: React.FC<MapPinSearchProps> = ({ pins, onSelect }) => {
  const t = useT();
  const uid = useId();
  const inputId = `${uid}-map-pin-search`;
  const listId = `${uid}-map-pin-results`;
  const [query, setQuery] = useState('');

  const hits = useMemo(() => matchMapPins(query, pins).slice(0, RESULT_LIMIT), [query, pins]);
  const open = query.trim().length > 0;

  const select = (pin: SearchablePin) => {
    onSelect(pin);
    setQuery('');
  };

  return (
    <div className="relative min-w-0">
      <label htmlFor={inputId} className="sr-only">
        {t('map.searchAria')}
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        autoComplete="off"
        placeholder={t('map.search')}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setQuery('');
          }
        }}
        className="w-full px-2 py-1.5 rounded-md border border-white/15 bg-black/50 text-xs sm:text-sm text-white placeholder:text-synth-muted"
      />
      {open ? (
        <div className="absolute z-[1300] left-0 right-0 mt-1 rounded-md border border-white/20 bg-black/90 shadow-lg overflow-hidden">
          {hits.length === 0 ? (
            <p role="status" className="px-2 py-2 text-[11px] text-synth-muted">
              {t('map.searchEmpty')}
            </p>
          ) : (
            <ul id={listId} className="max-h-48 overflow-y-auto">
              {hits.map((pin) => (
                <li key={pin.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-[11px] text-gray-100 hover:bg-white/10"
                    onClick={() => select(pin)}
                  >
                    <span className="font-semibold">{pin.name}</span>
                    <span className="ml-1 text-synth-muted">{pin.kindLabel}</span>
                    {pin.cityLabel ? (
                      <span className="ml-1 text-neon-cyan/80">{pin.cityLabel}</span>
                    ) : null}
                    {pin.notes?.trim() ? (
                      <span className="block truncate text-[10px] text-gray-400">{pin.notes}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default MapPinSearch;
