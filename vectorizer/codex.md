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
- The Windows launcher is
  `scripts/windows/ronyka-vectorizer-launcher.bat`. It checks the remote
  `vectorizer/package.json`, updates the complete installation only for a newer
  vectorizer version, runs the vectorizer's own locked dependency install when
  required, starts the server separately, and opens port 4174.
- The GUI generates path-only `original-vectorized.svg`; never embed the source
  raster.
- The CorelDRAW PDF action posts the flattened edited SVG to
  `/api/export-pdf`, where PDFKit and SVG-to-PDFKit create a genuine vector PDF
  at the SVG's physical millimeter dimensions. Never rasterize this export.
- SVG structure supports Inkscape layers, CorelDRAW-compatible ungrouped paths,
  and ordinary flat paths. CorelDRAW downloads must flatten artwork groups,
  inherit their transforms and visual attributes on child artwork, and strip
  Inkscape/vectorizer layer metadata while preserving SVG definitions and
  edits. Do not claim this can disable CorelDRAW's application-created locked
  import container; that state is not represented in the source SVG.
- Keep package.json, package-lock.json, and the visible GUI version synchronized
  only when committing a release.
- Update vectorizer/CHANGES.md, vectorizer/codex.md, and
  vectorizer/README.md for vectorizer work. Do not add vectorizer release notes
  or implementation guidance to root documentation.

Behavior:
- Generate a first preview immediately after image selection. Debounce settings,
  abort obsolete requests, and commit slider regeneration on pointer/key
  release. Keep manual Preview and current-result Download actions.
- In Multicolor mode, optional palette variations run the chosen color counts
  sequentially and display a selectable thumbnail gallery. Preserve an
  independent SVG, layer panel state, and 40-step Undo/Redo histories for each
  result when switching, downloading, or removing variations. Completed
  results remain usable if a later batch request is canceled.
- Cross-variation import copies selected active-result layers into a target
  variation as independent layers. Preserve referenced masks/clip paths and
  transforms, remap SVG IDs, and add the import to the target's Undo history
  without changing the active variation.
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
- Lasso Layer requires exactly one selected layer. Capture a freehand polygon
  in that root's local SVG coordinates, clone the enclosed artwork into a new
  clipped layer, and append the polygon as a black exclusion to the source
  layer's mask. Preserve existing source masks and clips, assign independent
  IDs, select the new layer, and commit the split as one history entry.
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
  scaled for brush size, SVG display scale, and zoom. Position the absolute
  cursor with the vector stage's horizontal and vertical scroll offsets, keep
  it synchronized on scroll, and do not cap it below the actual erase diameter.
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
- Unmodified `+`/`−` and Numpad Add/Subtract zoom by 25%. Use the last pointer
  position while it remains over the vector canvas; otherwise reset the zoom
  origin to its center. Do not override browser `Ctrl/Cmd` zoom shortcuts.
- In Cursor mode, pointer-dragging empty SVG canvas pans the scroll container
  vertically and horizontally; dragging a layer still moves the layer or
  selected layer set. Panning does not alter SVG source or history.
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
