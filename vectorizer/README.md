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

### Windows launcher

Run `scripts\windows\ronyka-vectorizer-launcher.bat` from the installed project.
It compares the local `vectorizer/package.json` version with the version
published on GitHub, updates the project only when a newer vectorizer version
exists, installs the vectorizer's locked dependencies when required, starts
the server in a separate terminal, and opens `http://localhost:4174/`.

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
Press `Esc` while vectorization is active to abort the browser request, close
the progress modal, and stop server-side multicolor processing between layer
traces.

**Curve smoothing** controls Potrace's corner threshold and Bézier optimization
tolerance. `50%` matches the prior tracing defaults; lower values retain more
angular detail, while higher values first soften each binary color mask and
then suppress noisy corners and combine more curve segments. Mask softening
increases progressively above `50%`, producing cleaner contours instead of
only simplifying already-jagged paths. The preview is retraced after pointer
or keyboard release.

**Trace resolution** supports a longest side from 500 to 20,000 pixels.
Resolutions near the upper limit can require several gigabytes of memory,
especially with large Multicolor palettes, and may take substantially longer
to process. Increase it only when the exported paths require that detail.
**Allow trace upscaling** optionally enlarges smaller source images to that
resolution. It defaults off, is intentionally not saved in browser settings,
and should generally be limited to modest enlargement of small clean artwork.

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

Enable **Multiple palette variations** to compare the same source at several
palette counts. Add the current slider value or choose the Low detail,
Balanced, or Detailed preset, then generate the set in one operation. Completed
results appear as thumbnail cards above the preview. Select a card to edit its
layers, download that variation directly, or remove it. Switching cards keeps
each result's SVG edits, layer visibility and selection state, and independent
Undo/Redo history. Press `Esc` during the batch to cancel the active request;
variations that already completed remain available.

To combine results, select one or more layers in the active variation and use
the **⇥** import action on a different variation card. The layers are copied
into that target result with their colors, transforms, masks, and clip paths.
The copies receive independent SVG IDs and are added as one Undoable change in
the target variation.

Use **Layer groups (Inkscape)** to export native Inkscape layer groups, or
**Flat paths** to export each color as one top-level path without a
parent group. Choose **Ungrouped paths (CorelDRAW)** to flatten generated and
edited artwork groups into top-level SVG paths. Group transforms and visual
attributes are inherited by their child artwork, and vectorizer-only layer
attributes are removed while preserving IDs, paths, masks, clips, colors, and
positions. CorelDRAW can still place imported SVG artwork into an
application-created locked container even when the SVG contains no lock or
group metadata. That container must be unlocked in CorelDRAW; it cannot be
disabled by an SVG attribute.
Layer naming and preview visibility work with every structure.

Use **CorelDRAW PDF** to download the current edited result as a genuine vector
PDF. The export uses the same flattened Corel-compatible paths regardless of
the selected SVG structure and retains the artwork's millimeter dimensions,
colors, curves, masks, clips, transforms, and stacking order. When palette
variations are active, the PDF action exports the currently selected
variation. The PDF contains vector drawing operators rather than a rasterized
copy of the source.
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
translation into the downloaded SVG. When the dragged layer belongs to a
multi-selection, every selected layer moves together while retaining its
relative offset. Clicking artwork selects its layer;
Shift+click toggles additional layers for multi-selection. Press `Delete`
(`Backspace` on keyboards where the Delete key reports that value) to remove
every selected layer, including its unused eraser mask, with Undo/Redo support.
**Reset positions** removes all manual layer translations. The source
is a small picture-in-picture card over the
vector workspace by default, leaving most space for the result. Drag its
caption to reposition it, use its lower-right handle to resize it, or hide it
with its minimize control. A compact **Source** edge tab restores a hidden preview.
The dedicated vector toolbar scales the generated preview from 50% to 400%.
Select Zoom In or Zoom Out, then click the exact image region that should
become the zoom focus. Click the percentage to reset to 100%, toggle the active
tool button, choose **Cursor**, or press `Esc` to return to normal layer
selection and dragging.
Press `+` or `−` to zoom immediately in 25% steps. When the pointer is over the
vector canvas, the shortcut zooms around that position; otherwise it uses the
canvas center. Numpad Add and Subtract are also supported.
In Cursor mode, drag empty canvas space to pan the scrollable preview vertically
or horizontally. Dragging
directly on artwork continues to move its layer or current multi-selection.

Select one or more layers, choose **Eraser** in the vector toolbar, adjust its
brush size, and drag over the preview to remove content only from those
selected layers. A circular cursor follows the pointer and scales with the
brush setting, SVG display scale, and preview zoom to show the affected area.
The cursor remains aligned with the actual erased region while the zoomed
preview is scrolled horizontally or vertically.
Erasures are stored as SVG masks, remain editable through Undo/Redo, and are
included in the downloaded SVG. Choose **Cursor** or press `Esc` to leave
eraser mode.

To recolor artwork, choose a color, activate the toolbar bucket, and click
visible artwork directly in the preview. The clicked layer becomes selected,
and its fill and palette swatch update together. Strokes created from the layer
fill follow the new color, while independent outline strokes keep their
existing color. Keep the bucket active to recolor additional layers; choose
**Cursor** or press `Esc` to exit. Each fill is one Undo/Redo operation and is
retained in SVG and PDF downloads.

To split artwork out of a layer, select exactly one layer and choose the
**Lasso Layer** tool. Draw around the desired region and release the pointer.
The enclosed portion becomes a newly selected independent SVG layer and is
masked out of the source layer, preserving the combined appearance. The split,
new clip path, and source mask are included in downloads and Undo/Redo history.

Layer edits retain up to 40 undo steps. Use the **Undo** and **Redo** buttons,
`Ctrl/Cmd+Z` to undo, and `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` to redo. History
includes layer names, visibility, positions, grouping, color merging, strokes,
erasing, and lasso splits. Generating a different vector result starts a new
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
Copies receive independent layer numbers, names, SVG IDs, and eraser masks;
later erasing a copy cannot modify its source layer.
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
