# Codex Session Prompt — Ronyka Vectorizer

```text
I am continuing development of the standalone Ronyka Vectorizer. Work only
inside vectorizer/ unless integration is explicitly requested. Read
vectorizer/CHANGES.md and vectorizer/README.md, then inspect the implementation
before editing.

Project invariants:
- This is a GPL-2.0-only Node.js ESM package, isolated from the MIT-licensed
  Ronyka Panel Splitter. Keep its server, GUI, dependencies, package lock,
  browser storage, and documentation inside vectorizer/.
- The server runs on port 4174 and accepts an in-memory upload. `npm start`
  launches the server. There is no processing CLI; any future CLI name must be
  distinct from the splitter's `split-image`.
- The GUI generates path-only `original-vectorized.svg`; never embed the source
  raster.
- Keep package.json, package-lock.json, and the visible GUI version synchronized
  only when committing a release.
- Update vectorizer/CHANGES.md, vectorizer/codex.md, and
  vectorizer/README.md for vectorizer work. Do not add vectorizer release notes
  or implementation guidance to root documentation.

Behavior:
- Generate a first preview immediately after image selection. Debounce settings,
  abort obsolete requests, and commit slider regeneration on pointer/key
  release. Keep manual Preview and current-result Download actions.
- Show vectorization progress in an auto-closing modal.
- While vectorization is active, `Esc` aborts the browser fetch, immediately
  closes the progress modal, restores Preview controls, and propagates an
  AbortSignal through the server into tracing. Check cancellation between
  expensive color-layer traces; do not report client cancellation as failure.
- Accept trace resolutions from 500 through 20,000 pixels on the longest side.
  Treat upper-range Multicolor processing as memory-intensive and avoid
  exercising the full ceiling in routine validation.
- Provide **Allow trace upscaling** as an unchecked, session-only control.
  Pass it to Sharp by negating `withoutEnlargement`; never persist it in local
  storage.
- Support Monochrome and Multicolor. Multicolor accepts 2–33 palette colors,
  optional corner-derived background removal, and preserved white artwork.
  Remove only background-color components connected to the canvas border so
  enclosed same-color details remain.
- Fill gaps only after exact masks have isolated-fragment cleanup. Merge only
  small, color-near antialias regions; retain substantial or distinct colors.
- Trace retained masks with Potrace. Support Inkscape layer groups and flat
  paths with palette metadata, editable names, unique IDs, titles, and
  data-name attributes.
- The Layers panel supports visibility, reversible Solo, hover highlighting,
  manual movement, reset positions, duplication, grouping without recoloring,
  swatch-to-swatch color merging, selected-layer strokes, and downloadable SVG
  masks for erasing selected layers.
- In Cursor mode, a click without a drag selects the clicked artwork layer,
  Shift+click toggles it in the current selection, and Delete/Backspace removes
  all selected layer roots plus masks no longer referenced by another root.
  Do not intercept those keys in editable text or number fields.
- Dragging a layer already in the current selection moves all selected roots
  by the same SVG-space delta and commits one history entry.
- Update each inline root's transform and `data-translate-x/y` together during
  dragging; later drags must start from the last committed position.
- Duplicate layers with their geometry, colors, strokes, transforms, and masks,
  but assign independent layer numbers, names, IDs, and cloned mask definitions.
  A duplicate must never share a mutable eraser mask with its source.
- Eraser mode has an adjustable brush, live mask preview, and a circular cursor
  scaled for brush size, SVG display scale, and zoom.
- Keep up to 40 layer-edit undo states. Support Undo/Redo buttons,
  Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y. Clear history for a new vector
  result.
- Preserve compatible names, visibility, selection, positions, strokes,
  groups, color merges, duplicates, and masks during retracing when the base
  generated layer count remains unchanged.
- Use a draggable/resizable/minimizable source picture-in-picture and optional
  split comparison. The vector toolbar uses accessible icon-only Cursor,
  Eraser, Zoom Out, and Zoom In tools. Region clicks focus 50%–400% zoom;
  displayed percentage resets to 100%; Cursor or Esc exits a drawing/zoom tool.
- Keep the picture-in-picture and minimized Source restore tab below the vector
  toolbar at their default positions; user dragging may reposition the card.
- Curve smoothing maps 50 to Potrace defaults and uses progressively stronger
  Gaussian binary-mask preprocessing above 50.

Before completing work:
1. Verify behavior against vectorizer/CHANGES.md and vectorizer/README.md.
2. Run node --check on public/app.js, server.js, and tracer.js.
3. Run git diff --check and a focused functional trace when processing changes.
4. Report validation and leave changes uncommitted unless asked to commit.
```
