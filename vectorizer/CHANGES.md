# Ronyka Vectorizer Changes

## v1.6.0 — Lasso and canvas navigation

- Added a Lasso Layer toolbar tool. Drawing a closed region on exactly one
  selected layer creates a new clipped layer and masks that region out of the
  source, with downloadable SVG definitions and Undo/Redo support.
- Added `+`/`−` and numpad zoom shortcuts. They focus on the pointer while it
  is over the vector canvas and otherwise use the canvas center.
- Added vertical and horizontal empty-canvas drag panning in Cursor mode
  without changing layers or creating history entries.

## v1.5.0 — Cancelable vectorization

- Added `Esc` cancellation for active vectorization: abort the browser request,
  close the progress modal, restore controls, and propagate cancellation to
  server-side tracing between color layers.

## v1.4.0 — Layer workflow and high-resolution tracing

- Added direct preview selection: click artwork to select its layer,
  Shift+click to toggle layers in a multi-selection, and press `Delete` to
  remove selected layers with Undo/Redo support.
- Dragging any selected artwork now moves the complete multi-selection in one
  history operation while retaining each layer's relative position.
- Keep inline translation metadata synchronized during dragging so subsequent
  drags continue from the moved position instead of snapping to the original.
- Accept both browser `Delete` and macOS-style `Backspace` key events for
  deleting selected layers outside editable fields.
- Clone referenced eraser masks into independent SVG definitions when
  duplicating layers so erasing a copy never changes its source.
- Increased layer-edit Undo/Redo history from 10 to 40 states.
- Moved the source picture-in-picture and its minimized restore tab below the
  vector toolbar by default so neither obscures tool controls.
- Increased the maximum trace resolution from 6,000 to 20,000 pixels, with
  documentation warning about high memory and processing costs.
- Added a session-only **Allow trace upscaling** option, disabled by default
  and intentionally excluded from browser local storage.

## v1.3.0 — Palette refinement and vector editing tools

- Increased the Multicolor palette limit from 16 to 33 colors.
- Changed background removal to clear only the matching color component
  connected to the canvas border, preserving enclosed details such as white
  eye highlights when **Keep white as a layer** is enabled.
- Optimized **Fill gaps between colors** by cleaning exact masks before
  expansion and merging small, color-near antialias regions into dominant
  colors, reducing unnecessary layers.
- Added **Duplicate selected** with preserved geometry, colors, strokes, and
  transforms plus unique layer numbers, names, and SVG IDs.
- Added an adjustable Eraser tool that modifies selected layers through
  downloadable SVG masks, supports Undo/Redo, and displays a scaled circular
  brush cursor.
- Replaced text toolbar controls with accessible pointer, eraser, and zoom
  icons.

## v1.2.0 — Interactive vector editing

- Added automatic first preview, debounced setting previews, release-committed
  sliders, and modal vectorization progress.
- Added genuine Multicolor tracing, palette metadata, editable named SVG
  layers, Inkscape groups or flat paths, white-layer preservation, optional
  background removal, isolated-component cleanup, and optional gap filling.
- Added a docked Layers panel with visibility, reversible Solo, hover
  highlighting, editable names, manual positioning, reset positions,
  multi-selection, grouping, color merging, and selected-layer strokes.
- Added persisted curve smoothing with Potrace tuning and Gaussian mask
  preprocessing above 50%.
- Preserved compatible layer configuration and grouped/merged structure across
  setting-driven retracing when the generated base layer count is unchanged.
- Added a 40-step Undo/Redo history with `Ctrl/Cmd+Z`,
  `Ctrl/Cmd+Shift+Z`, and `Ctrl+Y`.
- Added a draggable and resizable source picture-in-picture, minimize/restore
  tab, split comparison view, and a region-focused 50%–400% vector zoom
  toolbar with Cursor mode.

## v1.1.0 — Layered vector output

- Added genuine Multicolor mode with a persisted 2–16 color palette.
- Added palette display, layer visibility, editable layer naming, white-layer
  preservation, SVG structure selection, and layered SVG downloads.

## v1.0.0 — Standalone vectorizer

- Added an independent GPL-2.0-only server and GUI on port 4174.
- Added physical artwork height, black threshold, trace resolution, source and
  SVG previews, and path-only `original-vectorized.svg` downloads.
- Kept Potrace and all vectorizer dependencies isolated from the MIT-licensed
  Ronyka Panel Splitter.
- The package has no image-processing CLI command. `npm start` launches only
  the standalone server; any future CLI must use a vectorizer-specific name.
