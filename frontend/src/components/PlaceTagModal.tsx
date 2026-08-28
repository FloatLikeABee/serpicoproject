import React, { useEffect, useState } from 'react';
import { chatAPI } from '../services/api';
import ChatMarkdown from './ChatMarkdown';
import {
  forwardGeocode,
  isCoordsOnlyAddress,
  MapTag,
  MapTagKind,
  MAP_TAG_KINDS,
  reverseGeocode,
  tagMeta,
} from '../utils/mapTags';

interface PlaceTagModalProps {
  tag: MapTag;
  onChange: (tag: MapTag) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** Live pin/address updates while the modal is open (auto mapping). */
  onLocationUpdate?: (tag: MapTag) => void;
  /** New pins start in edit mode; reopening a saved tag starts compact view. */
  startInEditMode?: boolean;
  /** Limit type dropdown (Fleet uses stations / personnel / vehicles / scenes). */
  kindOptions?: typeof MAP_TAG_KINDS;
}

function cityFromMapAddress(address: string): string {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(', ');
  }
  return address.trim();
}

const PlaceTagModal: React.FC<PlaceTagModalProps> = ({
  tag,
  onChange,
  onDelete,
  onClose,
  onLocationUpdate,
  startInEditMode = false,
  kindOptions,
}) => {
  const kinds = kindOptions && kindOptions.length > 0 ? kindOptions : MAP_TAG_KINDS;
  const [draft, setDraft] = useState(tag);
  const [editing, setEditing] = useState(startInEditMode);
  const [enriching, setEnriching] = useState(false);
  const [mappingLocation, setMappingLocation] = useState(false);
  const [error, setError] = useState('');
  const [aiExpanded, setAiExpanded] = useState(false);
  const mappedPinKeyRef = React.useRef('');
  const meta = kinds.find((k) => k.kind === draft.kind) ?? tagMeta(draft.kind);

  const applyLocation = (next: MapTag) => {
    setDraft(next);
    onLocationUpdate?.(next);
  };

  useEffect(() => {
    setDraft(tag);
    setError('');
    setEditing(startInEditMode);
    setAiExpanded(!!tag.enrichment);
  }, [tag.id, startInEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull address updates from geocode without clobbering typed notes/name.
  useEffect(() => {
    if (!tag.address) return;
    setDraft((prev) => {
      if (prev.id !== tag.id) return prev;
      if (prev.address === tag.address) return prev;
      const coordsOnly = /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(prev.address || '');
      if (prev.address && !coordsOnly) return prev;
      return { ...prev, address: tag.address };
    });
  }, [tag.id, tag.address]);

  // Auto reverse-geocode pin coordinates to a street address.
  useEffect(() => {
    if (!isCoordsOnlyAddress(tag.address)) return;
    const key = `${tag.id}:${tag.lat.toFixed(5)},${tag.lng.toFixed(5)}`;
    if (mappedPinKeyRef.current === key) return;
    mappedPinKeyRef.current = key;

    let cancelled = false;
    setMappingLocation(true);
    void reverseGeocode(tag.lat, tag.lng)
      .then((address) => {
        if (cancelled || isCoordsOnlyAddress(address)) return;
        setDraft((prev) => {
          if (prev.id !== tag.id) return prev;
          const next = { ...prev, address, updatedAt: new Date().toISOString() };
          onLocationUpdate?.(next);
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setMappingLocation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tag.id, tag.lat, tag.lng, tag.address]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapAddressToPin = async () => {
    const query = draft.address?.trim();
    if (!query || isCoordsOnlyAddress(query)) return;
    setMappingLocation(true);
    setError('');
    try {
      const hit = await forwardGeocode(query);
      if (!hit) {
        setError('Could not map that address on the map.');
        return;
      }
      applyLocation({
        ...draft,
        lat: hit.lat,
        lng: hit.lng,
        address: hit.label,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setError('Location mapping failed.');
    } finally {
      setMappingLocation(false);
    }
  };

  const hasFilledInfo =
    draft.name.trim().length > 0 &&
    (draft.notes.trim().length > 0 || (!!draft.address && !isCoordsOnlyAddress(draft.address)));

  const enrichWithAI = async () => {
    if (!hasFilledInfo) {
      setError('Fill in a name plus notes or a street address, then create AI info.');
      return;
    }
    setEnriching(true);
    setError('');
    setAiExpanded(true);
    try {
      const placeLabel = draft.address || `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`;
      const cityHint = cityFromMapAddress(placeLabel);
      const prompt = [
        `MAP PIN FIELD BRIEF — answer only about this pin.`,
        `PIN TYPE: ${meta.label}`,
        `NAME: ${draft.name || meta.short}`,
        `COORDINATES: ${draft.lat}, ${draft.lng}`,
        `ADDRESS: ${placeLabel}`,
        `CITY / JURISDICTION: ${cityHint}`,
        draft.notes ? `OFFICER NOTES: ${draft.notes}` : '',
        `Write a short Markdown brief on this address and this ${meta.label.toLowerCase()}. Cover neighborhood/jurisdiction, how the notes apply, relevant public-safety context for THIS city, and suggested next checks.`,
        `Hard rules: the pin is in ${cityHint}. Do not mention Olathe, Kansas, Olathe PD, or any other city's crime stats unless that is this pin's city. If you lack records for this address, say so and stay in ${cityHint}.`,
      ]
        .filter(Boolean)
        .join('\n');

      const { response } = await chatAPI.sendMessage(prompt, 'in-pursue-place');
      const summary = (response?.content || '').trim();
      if (!summary) {
        setError('AI returned an empty summary.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        enrichment: { summary, fetchedAt: new Date().toISOString() },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI lookup failed');
    } finally {
      setEnriching(false);
    }
  };

  const openedInViewMode = !startInEditMode;

  const save = () => {
    onChange({
      ...draft,
      name: draft.name.trim() || meta.short,
      notes: draft.notes.trim(),
      updatedAt: new Date().toISOString(),
    });
  };

  const aiSummary = draft.enrichment?.summary;
  const aiFetchedAt = draft.enrichment?.fetchedAt;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg flex flex-col h-[min(92dvh,100%)] max-h-[min(92dvh,100%)] sm:h-auto sm:max-h-[85vh] game-panel border border-neon-cyan/35 rounded-t-xl sm:rounded-xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-tag-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fixed */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-display uppercase tracking-wider" style={{ color: meta.color }}>
                {meta.label}
              </p>
              <h2 id="place-tag-title" className="text-lg font-display font-bold text-white truncate">
                {editing ? 'Map tag' : draft.name || meta.short}
              </h2>
              <p className="text-[11px] text-synth-muted mt-0.5 truncate">
                {mappingLocation ? 'Mapping location…' : draft.address || `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-synth-muted hover:text-white text-sm px-2 min-h-0 min-w-0 flex-shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
          {error ? (
            <div className="rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
              {error}
            </div>
          ) : null}

          {editing ? (
            <>
              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Type</span>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft((p) => ({ ...p, kind: e.target.value as MapTagKind }))}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#0b0818] text-sm text-white"
                  style={{ colorScheme: 'dark' }}
                >
                  {kinds.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Label for this pin"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">
                  Location {mappingLocation ? '· mapping…' : ''}
                </span>
                <input
                  value={draft.address || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                  onBlur={() => void mapAddressToPin()}
                  placeholder="Auto-mapped from pin, or type an address"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
                />
                <p className="text-[10px] text-synth-muted/80">
                  Tap the map to place · edit address to re-map pin
                </p>
              </label>

              <label className="block space-y-1">
                <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="Observations, leads… (Markdown supported)"
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-none"
                />
                <p className="text-[10px] text-synth-muted/80">
                  Fill name and notes or address, then tap Create AI info.
                </p>
              </label>
            </>
          ) : (
            <>
              {draft.notes.trim() ? (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                  <p className="text-[9px] font-display uppercase tracking-wider text-synth-muted mb-1">Notes</p>
                  <ChatMarkdown content={draft.notes} size="xs" />
                </div>
              ) : null}
            </>
          )}

          {aiSummary ? (
            <div className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setAiExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-neon-magenta/10"
              >
                <span className="text-[9px] font-display uppercase tracking-wider text-neon-magenta">
                  AI location check
                  {aiFetchedAt ? ` · ${new Date(aiFetchedAt).toLocaleString()}` : ''}
                </span>
                <span className="text-[10px] text-neon-magenta/80 flex-shrink-0">
                  {aiExpanded ? 'Hide' : 'Show'}
                </span>
              </button>
              {aiExpanded ? (
                <div className="px-3 pb-3 max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain text-gray-200 leading-snug border-t border-neon-magenta/20">
                  <ChatMarkdown content={aiSummary} size="xs" />
                </div>
              ) : (
                <p className="px-3 pb-2 text-[11px] text-gray-400 line-clamp-4 border-t border-neon-magenta/20 pt-2">
                  {aiSummary.replace(/[#*_`]/g, '').slice(0, 140)}
                  {aiSummary.length > 140 ? '…' : ''}
                </p>
              )}
            </div>
          ) : enriching ? (
            <p className="text-[11px] text-neon-magenta animate-pulse px-1">Creating AI info…</p>
          ) : null}
        </div>

        {/* Footer — fixed */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-[#07050f]/95">
          {editing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void enrichWithAI()}
                disabled={enriching || !hasFilledInfo}
                title={
                  hasFilledInfo
                    ? 'Create AI info from the filled name, notes, and address'
                    : 'Add a name plus notes or a street address first'
                }
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/15 disabled:opacity-50"
              >
                {enriching ? 'Creating…' : 'Create AI info'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this map tag?')) onDelete(draft.id);
                  }}
                  className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-serpico-red/40 text-serpico-red"
                >
                  Delete
                </button>
                {!openedInViewMode ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-white/15 text-gray-300"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-white/15 text-gray-300"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={save}
                  className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase bg-serpico-blue/80 text-white hover:bg-serpico-blue"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void enrichWithAI()}
                disabled={enriching || !hasFilledInfo}
                title={
                  hasFilledInfo
                    ? 'Create AI info from the filled name, notes, and address'
                    : 'Add a name plus notes or a street address first'
                }
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/15 disabled:opacity-50"
              >
                {enriching ? 'Creating…' : 'Create AI info'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this map tag?')) onDelete(draft.id);
                }}
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-serpico-red/40 text-serpico-red"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-neon-cyan/40 text-neon-cyan"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase bg-serpico-blue/80 text-white hover:bg-serpico-blue"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaceTagModal;
