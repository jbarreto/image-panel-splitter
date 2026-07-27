# Ronyka Vectorizer

Standalone server and browser GUI for converting monochrome or flat-color
artwork into genuine editable SVG paths. It runs independently from Ronyka
Panel Splitter.

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
preview. Slider values update while dragging, but processing waits until mouse
or touch release; the artwork-height field uses a short typing debounce.
**Preview vector** remains available for an immediate refresh. The SVG contains
Potrace path geometry and never embeds the source raster. A modal progress bar
reports upload, path tracing, and preview rendering, then closes automatically
after completion.

Choose **Multicolor** to quantize the source into 2–16 palette colors and
trace each color as a separate filled path layer. Background-color removal is
enabled by default, while **Keep white as a layer** detects white from the
original corner pixels, preserves it as a true-white palette layer, and keeps
white details even when white is the background. This mode works best for
logos, cartoons, and flat-color illustrations; photographs and gradients
produce more approximate results. Adjacent retained color masks overlap by one
trace pixel inside the artwork boundary to prevent transparent hairline gaps
caused by independently smoothed vector paths.

Use **Layer groups (Inkscape)** to export native Inkscape layer groups, or
**Flat paths** to export each color as one top-level path without a
parent group. Layer naming and preview visibility work with either structure.
The generated palette appears in the GUI with a swatch, layer number, and hex
value. The SVG stores every color in a named Inkscape-compatible layer group,
or as a named top-level path when flat structure is selected. The GUI
**Layers** panel also provides per-layer visibility controls
for inspecting the vector preview. The panel is docked beside the preview and
uses Photoshop-style eye controls plus **Show all** and **Hide all** actions.
Hovering a color region in the inline SVG preview highlights its corresponding
Layers-panel row. Dragging that region moves the complete layer and writes its
translation into the downloaded SVG. **Reset positions** removes all manual
layer translations. A divider tab collapses the source preview to the left so
the vector preview can use the full preview area.
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
