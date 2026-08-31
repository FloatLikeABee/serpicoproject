## Context

See `proposal.md` for motivation. Fleet chips already call `t('fleet.short.*')` / `t('fleet.kind.*')`; Pursue chips still render `k.short` / `k.label` from English `MAP_TAG_KINDS`. PlaceTagModal uses `meta.label` from those tables. The Fleet nav SVG uses the same 20×20 `iconProps` as siblings, but the car path sits at y≈12–19 so it looks smaller.

## Goals / Non-Goals

**Goals:**

- Centered, larger Fleet nav vehicle (or equivalent) in the existing 24 viewBox.
- Catalog keys for every Pursue `MAP_TAG_KINDS` short + label; render chips, banners, and modal types via `t()`.
- Fleet modal type strings use existing `fleet.kind.*` keys (not the English `FLEET_MARKER_KINDS.label`).
- PlaceTagModal field chrome that is still hardcoded (`Type` / `Name` / `Notes` / mapping line) uses existing `pin.*` keys so China pin UI is consistent.

**Non-Goals:**

- Translating stored pin names/notes or default names already saved on device.
- Changing glyph letters (O, N, V, …).
- Civilian nav icons, Board feed copy, or AI fallbacks.
- Reviving Chase Game.

## Decisions

### 1. Catalog `tag.kind.<kind>` and `tag.short.<kind>` for Pursue; reuse `fleet.kind.*` / `fleet.short.*` for Fleet

Keep color/glyph in `MAP_TAG_KINDS`. Display strings go through `t()`. InPursue interpolates `{kind}` with the catalog label, not `tagMeta().label`.

- **Why:** Matches existing Fleet chip pattern; catalog tests already require every EN key in ZH.
- **Alternative considered:** Nation-aware maps inside `mapTags.ts`. Rejected; chrome belongs in the catalog.

### 2. Redraw the Fleet SVG in place (still a vehicle)

Keep a car/van metaphor, scaled so body+wheels span roughly y=4–20, strokeWidth 2.5 like siblings.

- **Why:** User asked for size, not a new metaphor.
- **Alternative considered:** Reuse Pursue pin icon. Rejected; Fleet should stay distinct.

### 3. Do not migrate existing pin `name` fields

New pins may still default to the English `meta.short` stored as the name unless the create path uses the localized short at insert time. Prefer: default **display** of empty/generated names uses `t()`, but do not bulk-rename saved pins.

- **Why:** Spec forbids rewriting officer-authored names; many defaults were saved as “Case” / “Station pin”.
- **Alternative considered:** Rewrite all defaults on nation switch. Rejected.

## Risks / Trade-offs

- **[Chinese chips + `uppercase` CSS look unchanged]** → Mitigation: Tailwind `uppercase` does not alter Han; keep glyphs for scanability.
- **[Banner still English if `{kind}` is passed the raw `label`]** → Mitigation: pass `t('tag.kind.' + kind)` into `pursue.tap` / `pursue.banner`.
- **[Fleet `t('fleet.kind.police_station')` vs `fleet.kind.station`]** → Mitigation: chips already map kind → station/staff/vehicle/scene; modal MUST use the same mapping or the `fleet.kind.<MapTagKind>` keys that already exist.

## Migration Plan

Frontend-only deploy. Rollback: revert catalog keys and Navigation SVG.

## Open Questions

None that block the spec.
