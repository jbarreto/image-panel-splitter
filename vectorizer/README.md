# Ronyka Vectorizer

Standalone server and browser GUI for converting monochrome or flat-color
artwork into genuine editable SVG paths. It runs independently from Ronyka
Panel Splitter.

Vectorizer release history is maintained in [CHANGES.md](CHANGES.md), and its
development prompt and implementation invariants are maintained in
[codex.md](codex.md). Vectorizer documentation updates belong in this folder,
not in the parent panel-splitter documentation.

## Install

```bash
cd vectorizer
npm install
```

## Run

```bash
npm start
```

Open `http://localhost:4174`. Set `PORT` to use another port.

The GUI accepts any Sharp-supported image, lets you set the physical artwork
height, black threshold, and trace resolution, shows source and generated
vector previews side by side, and downloads `original-vectorized.svg`. Use
**Preview vector** to generate and inspect the result, then **Download SVG** to
save that exact preview. Changing the image or a tracing setting invalidates
the previous result. Valid setting changes automatically regenerate the
preview, and selecting or dropping a new image immediately generates its first
preview with the current settings. Slider values update while dragging, but
processing waits until mouse or touch release; the artwork-height field uses a
short typing debounce.
**Preview vector** remains available for an immediate refresh. The SVG contains
Potrace path geometry and never embeds the source raster. A modal progress bar
reports upload, path tracing, and preview rendering, then closes automatically
after completion.

**Curve smoothing** controls Potrace's corner threshold and Bézier optimization
tolerance. `50%` matches the prior tracing defaults; lower values retain more
angular detail, while higher values first soften each binary color mask and
then suppress noisy corners and combine more curve segments. Mask softening
increases progressively above `50%`, producing cleaner contours instead of
only simplifying already-jagged paths. The preview is retraced after pointer
or keyboard release.

Choose **Multicolor** to quantize the source into 2–33 palette colors and
trace each color as a separate filled path layer. Background-color removal is
enabled by default, while **Keep white as a layer** detects white from the
original corner pixels, preserves it as a true-white palette layer, and keeps
white details even when white is the background. Background removal clears
only pixels of that color connected to the canvas border, preserving enclosed
same-color artwork such as white eye highlights. This mode works best for
logos, cartoons, and flat-color illustrations; photographs and gradients
produce more approximate results. **Fill gaps between colors** optionally
overlaps adjacent retained color masks by one trace pixel inside the artwork
boundary to prevent transparent hairline gaps caused by independently smoothed
vector paths. When enabled, it also merges only small palette regions that are
very close to a larger neighboring color, preventing narrow antialias shades
from becoming unnecessary layers. Substantial and distinctly colored regions
remain separate. Before tracing, small isolated mask components are removed
using a threshold scaled to the tracing resolution, reducing antialias-derived
color dots without removing connected strokes or significant fills.

Use **Layer groups (Inkscape)** to export native Inkscape layer groups, or
**Flat paths** to export each color as one top-level path without a
parent group. Layer naming and preview visibility work with either structure.
The generated palette appears in the GUI with a swatch, layer number, and hex
value. The SVG stores every color in a named Inkscape-compatible layer group,
or as a named top-level path when flat structure is selected. The GUI
**Layers** panel also provides per-layer visibility controls
for inspecting the vector preview. The panel is docked beside the preview and
uses Photoshop-style eye controls plus **Show all** and **Hide all** actions.
Each row also has an **S** (Solo) control that shows only that layer; use
**Show all** to make every layer visible again. Clicking the active **S** a
second time restores the exact visibility state from before Solo was enabled;
switching between Solo layers keeps that original snapshot.
Hovering a color region in the inline SVG preview highlights its corresponding
Layers-panel row. Dragging that region moves the complete layer and writes its
translation into the downloaded SVG. **Reset positions** removes all manual
layer translations. The source is a small picture-in-picture card over the
vector workspace by default, leaving most space for the result. Drag its
caption to reposition it, use its lower-right handle to resize it, or hide it
with its minimize control. A compact **Source** edge tab restores a hidden preview.
The dedicated vector toolbar scales the generated preview from 50% to 400%.
Select Zoom In or Zoom Out, then click the exact image region that should
become the zoom focus. Click the percentage to reset to 100%, toggle the active
tool button, choose **Cursor**, or press `Esc` to return to normal layer
selection and dragging.

Select one or more layers, choose **Eraser** in the vector toolbar, adjust its
brush size, and drag over the preview to remove content only from those
selected layers. A circular cursor follows the pointer and scales with the
brush setting, SVG display scale, and preview zoom to show the affected area.
Erasures are stored as SVG masks, remain editable through Undo/Redo, and are
included in the downloaded SVG. Choose **Cursor** or press `Esc` to leave
eraser mode.

Layer edits retain up to ten undo steps. Use the **Undo** and **Redo** buttons,
`Ctrl/Cmd+Z` to undo, and `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` to redo. History
includes layer names, visibility, positions, grouping, color merging, strokes,
and erasing. Generating a different vector result starts a new
history.
**Split view** switches to side-by-side source and vector previews for direct
image comparison, and **Picture in picture** returns to the compact overlay
at its previous position and size.
Hovering a Layers-panel row also highlights its complete artwork layer and
temporarily dims other layers in the inline preview. This visual emphasis is
preview-only and does not alter the downloaded SVG.
Select two or more Layers-panel rows and choose **Group selected** to combine
them into one SVG layer. The merged group retains every child path's fill and
manual translation, so merging does not flatten the colors into one fill.
Choose **Duplicate selected** to clone one or more selected layers directly
after their sources while retaining paths, colors, strokes, and transforms.
Copies receive independent layer numbers, names, and SVG IDs.
To merge colors, drag a source layer's color swatch onto a solid-color target
swatch. Every source path adopts the target fill (and matching fill stroke),
then moves into the target layer; the source layer is removed.
Use **Selected layer stroke** to expand the selected layers with strokes that
match each path's own fill. This can manually cover remaining seams without
recoloring multicolor merged layers. The stroke is saved only after pointer or
keyboard release and is included in the downloaded SVG.

When a tracing setting regenerates the preview with the same number of layers,
the GUI restores layer names, visibility, selection, manual translations, and
fill-stroke widths by palette order. Grouped and color-merged layers are kept
as a structural template: their original member paths receive the newly traced
geometry, so smoothing applies inside a merge without undoing it. If the base
number of generated paths changes, the prior layer configuration is discarded
rather than applying it to different colors.
Layer names can be edited directly in the panel and are written to the
downloaded SVG as Inkscape labels, standard SVG IDs, `data-name` attributes,
and title metadata for broader compatibility with vector editors.
Simple unique names are used directly as path IDs, so a layer named `ojos`
appears as `ojos` in editors that display the path ID; a layer-number suffix is
added only when necessary to avoid a duplicate SVG ID.
Visibility controls are preview-only; downloaded SVGs retain every generated
layer.

This standalone application is licensed `GPL-2.0-only`. The parent Ronyka
Panel Splitter application remains MIT-licensed and does not import or depend
on this application.
