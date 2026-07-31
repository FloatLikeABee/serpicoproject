import React, { useEffect, useState } from 'react';
import { chatAPI } from '../services/api';
import { MapTag, MapTagKind, MAP_TAG_KINDS, tagMeta } from '../utils/mapTags';

interface PlaceTagModalProps {
  tag: MapTag;
  onChange: (tag: MapTag) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** Kick off AI web lookup when the modal opens (e.g. right after placing). */
  autoEnrich?: boolean;
}

const PlaceTagModal: React.FC<PlaceTagModalProps> = ({
  tag,
  onChange,
  onDelete,
  onClose,
  autoEnrich = false,
}) => {
  const [draft, setDraft] = useState(tag);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState('');
  const autoStarted = React.useRef(false);
  const meta = tagMeta(draft.kind);

  useEffect(() => {
    setDraft(tag);
    setError('');
  }, [tag]);

  const enrichWithAI = async () => {
    setEnriching(true);
    setError('');
    try {
      const placeLabel = draft.address || `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`;
      const prompt = [
        `Investigate this tagged map location for police intel.`,
        `Tag type: ${meta.label}`,
        `Name: ${draft.name || meta.short}`,
        `Coordinates: ${draft.lat}, ${draft.lng}`,
        `Address / place: ${placeLabel}`,
        draft.notes ? `Officer notes so far: ${draft.notes}` : '',
        `Use web search / crime news if available.`,
        `Summarize: what this place appears to be, nearby context in Olathe KS area, any relevant crime or investigative angles, and suggested next checks.`,
        `Write clear plain paragraphs (no JSON).`,
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
        notes: prev.notes?.trim() ? prev.notes : summary.slice(0, 800),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI lookup failed');
    } finally {
      setEnriching(false);
    }
  };

  useEffect(() => {
    if (!autoEnrich || autoStarted.current || tag.enrichment) return;
    autoStarted.current = true;
    void enrichWithAI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnrich, tag.id]);

  const save = () => {
    onChange({
      ...draft,
      name: draft.name.trim() || meta.short,
      notes: draft.notes.trim(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto game-panel border border-neon-cyan/35 rounded-t-xl sm:rounded-xl p-4 space-y-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-tag-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-display uppercase tracking-wider" style={{ color: meta.color }}>
              {meta.label}
            </p>
            <h2 id="place-tag-title" className="text-lg font-display font-bold text-white truncate">
              Map tag
            </h2>
            <p className="text-[11px] text-synth-muted mt-0.5">
              {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-synth-muted hover:text-white text-sm px-2 min-h-0 min-w-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-serpico-red/40 bg-serpico-red/10 px-3 py-2 text-xs text-serpico-red">
            {error}
          </div>
        ) : null}

        <label className="block space-y-1">
          <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Type</span>
          <select
            value={draft.kind}
            onChange={(e) => setDraft((p) => ({ ...p, kind: e.target.value as MapTagKind }))}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
          >
            {MAP_TAG_KINDS.map((k) => (
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
          <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Location</span>
          <input
            value={draft.address || ''}
            onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
            placeholder="Address or place description"
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[9px] font-display uppercase tracking-wider text-synth-muted">Notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            rows={5}
            placeholder="Case notes, observations, leads…"
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-white resize-y"
          />
        </label>

        {draft.enrichment?.summary ? (
          <div className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/5 px-3 py-2 space-y-1">
            <p className="text-[9px] font-display uppercase tracking-wider text-neon-magenta">
              AI location check
              {draft.enrichment.fetchedAt
                ? ` · ${new Date(draft.enrichment.fetchedAt).toLocaleString()}`
                : ''}
            </p>
            <p className="text-[11px] text-gray-200 whitespace-pre-wrap leading-snug">
              {draft.enrichment.summary}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => void enrichWithAI()}
            disabled={enriching}
            className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase tracking-wider border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/15 disabled:opacity-50"
          >
            {enriching ? 'Checking…' : 'AI check place'}
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
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase border border-white/15 text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="px-3 py-1.5 rounded-md text-[10px] font-display uppercase bg-serpico-blue/80 text-white hover:bg-serpico-blue"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceTagModal;
