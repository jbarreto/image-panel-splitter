# Ronyka Panel Splitter — Project Handoff and Change History

This document is the authoritative context handoff for continuing the **Ronyka Panel Splitter** project in a new ChatGPT conversation or with another developer.

## 1. Project purpose

The project is a Node.js application that takes a large PNG or other Sharp-supported image and divides it into multiple print-sized PNG panels for assembling a large poster.

The main use case is Cricut **Print Then Cut**, where every exported panel must fit inside Cricut's usable printable area instead of using an entire paper sheet.

The project provides:

- a command-line interface;
- a local browser GUI;
- image drag-and-drop;
- live grid preview;
- ZIP export;
- optional numbered panels;
- optional full-poster grid preview;
- preservation of PNG transparency.

## 2. Runtime and dependencies

- Node.js: `>=20.9.0`
- Module type: ESM (`"type": "module"`)
- Main image library: `sharp`
- GUI server: `express`
- Upload handling: `multer`
- ZIP generation: `archiver`
- Logging: `winston`

Current dependencies from `package.json`:

```json
{
  "sharp": "^0.35.3",
  "express": "^5.1.0",
  "multer": "^2.0.2",
  "archiver": "^7.0.1",
  "winston": "^3.19.0"
}
```

The CLI and GUI server share `src/logger.js`. Logging defaults to `debug` and
can be overridden with `LOG_LEVEL=info`, `LOG_LEVEL=warn`, or another Winston
level. CLI diagnostic logs are written to stderr so its stable stdout progress
lines remain parseable by the GUI server.

## 3. Repository layout

```text
image-panel-splitter/
├── CHANGES.md
├── LICENSE
├── README.md
├── package.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
└── src/
    ├── gui-server.js
    └── index.js
```

## 4. Core image behavior

### 4.1 No scaling by default

The default mode is:

```text
--fit actual
```

In this mode:

- the source image is not resized;
- one source pixel remains one output image pixel;
- the image is only cropped into page-sized regions;
- `--dpi` determines how many pixels correspond to the requested physical panel size and writes density metadata;
- incomplete panels are padded without altering source pixels.

### 4.2 Intentional physical scaling

The complete poster can be intentionally resized using:

```text
--target-width-mm <number>
--target-height-mm <number>
```

For example, to make the assembled poster exactly one meter tall:

```bash
node src/index.js input.png \
  --target-height-mm 1000 \
  --output ./panels
```

A target physical dimension overrides strict no-scaling intent. Do not describe `--fit actual` and `--target-height-mm` as simultaneously preserving original scale; the target dimension intentionally scales the complete image.

### 4.3 Large poster pixel limits

Poster-sized intermediate images can legitimately exceed Sharp's default input
safety limit of approximately 268 megapixels. This is especially likely with a
large physical target such as:

```text
--target-height-mm 4000
```

`src/index.js` opens the source and all encoded intermediate poster buffers
through `openImage()`, which sets:

```js
{ limitInputPixels: false }
```

The full-size SVG grid composite also disables the input pixel limit. Preserve
this behavior when adding image-processing stages; reopening a poster-sized
buffer with a plain `sharp(buffer)` can reintroduce the
`Input image exceeds pixel limit` export failure.

## 5. Physical panel limits

The application maps paper size and orientation to maximum custom panel dimensions.

### Landscape

```text
Maximum width:  9.26 in
Maximum height: 6.55 in
```

CLI example:

```bash
node src/index.js input.png \
  --orientation landscape \
  --panel-width-in 9.26 \
  --panel-height-in 6.55 \
  --dpi 144 \
  --margin-mm 0 \
  --output ./panels
```

### Portrait

```text
Maximum width:  6.55 in
Maximum height: 9.26 in
```

CLI example:

```bash
node src/index.js input.png \
  --orientation portrait \
  --panel-width-in 6.55 \
  --panel-height-in 9.26 \
  --dpi 144 \
  --margin-mm 0 \
  --output ./panels
```

Both the CLI and GUI export endpoint validate these limits.

US Letter uses the limits above. US Legal uses:

### Legal landscape

```text
Maximum width:  11.84 in
Maximum height: 6.76 in
```

### Legal portrait

```text
Maximum width:  6.76 in
Maximum height: 11.84 in
```

In the GUI, changing paper size or orientation:

- swaps the width and height maximums;
- resets both dimensions to the maximum valid values for that orientation;
- updates the preview immediately.

## 6. Cricut DPI behavior

Cricut Design Space commonly imports raster images according to a 144-PPI physical-size interpretation.

For Cricut-targeted output, the project commonly uses:

```text
--dpi 144
```

At 144 DPI:

```text
9.26 in × 144 ≈ 1333 px
6.55 in × 144 ≈ 943 px
```

This allows a generated landscape panel to import close to `9.26 × 6.55 in` in Design Space.

## 7. Transparency requirements

PNG alpha transparency must be preserved throughout the pipeline.

Current intended behavior:

- transparent source pixels remain transparent;
- resizing preserves alpha;
- cropped panels preserve alpha;
- unused space on partial edge panels is transparent;
- margins are transparent rather than white;
- `original-with-grid.png` uses an RGBA canvas;
- all exported poster panels remain transparent where the source is transparent;
- intentional grid lines and number graphics can remain opaque or semi-transparent.

Do not reintroduce three-channel RGB canvases or white backgrounds unless explicitly requested.

## 8. Grid behavior

### 8.1 Grid is preview-only

The user requested that grid lines appear **only** in:

```text
original-with-grid.png
```

The individual poster panel PNGs must remain clean and contain no grid lines.

This is a critical current requirement.

### 8.2 Grid options

```text
--grid-lines
--grid-line-width-mm <number>
--grid-color <CSS/SVG color>
--grid-mode padding|overlay
```

Current meaning:

- the default grid color is `rgb(1, 168, 107)` / `#01a86b`;
- `overlay`: draws grid lines over the full preview artwork;
- `padding`: inserts separator strips in the full preview without replacing artwork pixels;
- neither mode may change panel crop positions, panel dimensions, panel count, or panel pixels;
- the grid is not baked into poster panel PNGs.

Example:

```bash
node src/index.js input.png \
  --orientation landscape \
  --panel-width-in 9.26 \
  --panel-height-in 6.55 \
  --dpi 144 \
  --margin-mm 0 \
  --target-height-mm 1000 \
  --grid-lines \
  --grid-mode padding \
  --grid-line-width-mm 1 \
  --grid-color red \
  --no-number \
  --output ./panels
```

Expected output:

```text
original-with-grid.png        # full assembled preview with grid
panel-0-r1-c1.png             # clean panel, no grid
panel-1-r1-c2.png             # clean panel, no grid
...
assembly-guide.txt
assembly-guide.json
```

## 9. Panel numbering

Panel numbering begins at `0`, proceeds left-to-right, then top-to-bottom.

Example:

```text
0  1  2
3  4  5
6  7  8
```

Supported options:

```text
--number-position inside|center|top|bottom
--number-size-mm <number>
--label-height-mm <number>
--no-number
--no-label
```

`--no-label` is an alias for `--no-number`.

### Inside placement

The default number placement attempts to:

1. detect enclosed light/white regions bounded by dark painted lines;
2. choose the largest suitable enclosed region;
3. place the panel number inside it;
4. fall back to the artwork centroid when no enclosed region is found;
5. fall back to panel center when no artwork region can be determined.

The number uses a readable backing marker, currently intended as a translucent white circle.

## 10. CLI options

The current CLI supports at least:

```text
--output <directory>
--paper letter|legal
--panel-width-in <number>
--panel-height-in <number>
--orientation portrait|landscape
--dpi <number>
--margin-mm <number>
--overlap-mm <number>
--number-position inside|center|top|bottom
--label-height-mm <number>
--number-size-mm <number>
--fit actual|width|height
--target-width-mm <number>
--target-height-mm <number>
--prefix <text>
--grid-lines
--grid-line-width-mm <number>
--grid-mode padding|overlay
--grid-color <color>
--no-number
--no-label
```

The exact parser and validation logic are in `src/index.js`.

## 11. GUI behavior

Start the GUI with:

```bash
npm install
npm run gui
```

Open:

```text
http://localhost:4173
```

The GUI provides:

- Ronyka branding in the page title and control-panel header, using the local
  `public/ronyka-logo.jpg` asset, the browser title `Ronyka Panel Splitter`,
  the visible heading `Panel Splitter`, and a small `v1.21.0` version label;
- a Cricut-inspired color treatment built around green primary actions, dark
  charcoal text, clean white cards, pale mint surfaces, and subtle neutral
  borders, without using Cricut logos or proprietary assets;
- drag-and-drop image selection;
- regular file-picker input;
- a selected-image label showing the filename and original pixel dimensions beneath the image picker;
- orientation selection;
- a centimeter/inch selector for panel width, panel height, panel limits, and
  the assembled-poster dimensions in the preview summary; poster height and
  grid width inputs remain in millimeters, and imperial is selected by default;
- panel width slider;
- panel height slider;
- draggable interior preview grid lines that update the matching width or height slider, with diagonal dragging anywhere inside a panel to update both;
- DPI input;
- target poster height in millimeters;
- grid line width;
- grid color;
- live grid preview;
- calculated rows, columns, total panel count, and assembled poster size;
- a modal live-export progress bar showing generated panels, ZIP creation, and download;
- ZIP export.

Export status text is not rendered beneath the ZIP button. Preparing,
generation, ZIP, completion, cancellation, and error feedback belongs in the
modal. The selected-image filename and pixel dimensions remain visible in their
own label beneath the image picker.

### GUI orientation limits

Landscape:

```text
Letter width slider max:  9.26
Letter height slider max: 6.55
Legal width slider max:      11.84
Legal height slider max:     6.76
```

Portrait:

```text
Letter width slider max:  6.55
Letter height slider max: 9.26
Legal width slider max:      6.76
Legal height slider max:     11.84
```

The front-end implementation is in `public/app.js`. Server-side validation is duplicated in `src/gui-server.js`; keep both implementations synchronized.

## 12. GUI export path

The browser sends a multipart request to:

```text
POST /api/export
```

The browser includes a unique export ID and polls:

```text
GET /api/export-progress/:id
```

The server parses CLI output as panels are created and reports the current
phase (`preparing`, `generating`, `zipping`, `complete`, `canceled`, or
`error`), completed panel count, and total panel count. Progress records expire
after 10 minutes.
The front end presents progress in a blocking modal, maps panel generation to
the main portion of the progress bar, and reserves the final portion for ZIP
creation and download. The modal exposes a Close button after success or
failure. Pressing Escape while an export is active aborts the browser request
and sends:

```text
DELETE /api/export/:id
```

The server terminates the matching CLI child process, aborts ZIP creation when
applicable, marks progress as canceled, and removes partial temporary output.
A second Escape press dismisses the modal; completed and failed modals can also
be dismissed with Escape or the Close button. While generation is active, the
hint reads `Press Esc to cancel generation.` Once the export completes, is
canceled, or fails, it changes to `Press Esc to close`.

The server:

1. accepts the uploaded image through Multer;
2. validates panel dimensions and orientation;
3. invokes `src/index.js` as a child process;
4. creates a temporary output directory beneath `os.tmpdir()`;
5. ZIPs the output using Archiver;
6. sends `poster-panels.zip` to the browser;
7. deletes the uploaded source file;
8. deletes the generated export directory as soon as the ZIP response finishes
   or the client connection closes.

The GUI currently requests a grid preview while keeping exported panel PNGs clean.

### Temporary-file lifecycle

The exact temporary root is platform-dependent because the server uses
`os.tmpdir()`. On macOS it commonly resembles:

```text
/var/folders/.../T/
```

Each export uses:

```text
<os.tmpdir()>/image-panel-splitter-<random-id>/panels/
```

Multer uploads use:

```text
<os.tmpdir()>/image-panel-splitter-uploads/
```

Normal cleanup is tied to the HTTP response lifecycle and is idempotent:

- successful ZIP response: remove the export directory on `finish`;
- interrupted client connection: remove it on `close`;
- handled failure before a response is sent: remove it immediately;
- uploaded source: remove it in the request's `finally` block.

As crash recovery, the GUI server removes app-owned export directories and
uploads older than 24 hours when it starts and once per hour afterward. Recent
items are left untouched. Keep both immediate cleanup and stale cleanup: stale
cleanup alone does not prevent normal exports from consuming temporary storage.

## 13. Public access with Cloudflare Tunnel

The local GUI can be exposed temporarily with:

```bash
cloudflared tunnel --url http://localhost:4173
```

A quick tunnel generates a random address such as:

```text
https://charter-critical-budget-lat.trycloudflare.com
```

Important:

- a `trycloudflare.com` quick-tunnel hostname cannot be chosen manually;
- it lasts only while the `cloudflared` process runs;
- a stable custom hostname requires a Cloudflare account, a domain managed by Cloudflare, and a named tunnel.

The GUI handles file uploads and ZIP generation, so exposing it publicly should eventually include upload limits, MIME checks, authentication, rate limiting, and careful temporary-file cleanup.

## 14. Cricut workflow decisions

### PNG limitations

A PNG imports into Cricut Design Space as a single flattened raster layer. Grid or artwork elements inside the PNG cannot be ungrouped.

### SVG limitations and recommended pairing

For separate printed artwork and vector cut paths, the preferred output model is two matched files per panel:

```text
panel-00-print.png
panel-00-cut.svg
```

The PNG contains visible printed artwork. The SVG contains only the vector cut path.

In Cricut Design Space, both must be imported, given the same physical dimensions, centered, and attached. Do not flatten the cut path into the printed layer unless an outer-only cut is desired.

This paired PNG/SVG export is a discussed future enhancement; confirm whether it exists before claiming it is implemented.

### Batch import limitation

Cricut Design Space generally requires raster images to be uploaded one at a time. The current project produces individual PNG panels but does not automate Design Space.

## 15. Validation history

Syntax validation previously passed for:

```text
src/index.js
src/gui-server.js
public/app.js
```

Recent functional validation also completed a synthetic 4000 mm poster-height
CLI export with grid preview and 325 panels. A startup-cleanup test created an
aged export directory and aged upload, then confirmed that the GUI server
removed both.

After future changes, validate with:

```bash
npm install
node --check src/index.js
node --check src/gui-server.js
node --check public/app.js
npm run gui
```

Then verify:

```bash
curl http://localhost:4173
```

Finally, perform a GUI upload/export test and inspect the ZIP.

## 16. Important invariants for future changes

Do not break these without explicit user approval:

1. Original PNG transparency is preserved.
2. Grid lines appear only in `original-with-grid.png`.
3. Poster panel PNGs do not contain grid lines.
4. Letter landscape limits are `9.26 × 6.55 in`; Legal landscape limits are `11.84 × 6.76 in`.
5. Letter portrait limits are `6.55 × 9.26 in`; Legal portrait limits are `6.76 × 11.84 in`.
6. Both front-end and server-side validation enforce the same limits.
7. Default CLI mode does not scale the source image.
8. Target physical width or height intentionally enables scaling.
9. Numbering starts at `0`.
10. `--no-number` and `--no-label` both disable numbers.
11. GUI preview updates live as panel dimensions change.
12. Exported panels retain transparent padding rather than white padding.
13. Dragging an interior GUI preview grid line updates the corresponding panel dimension without bypassing its limits; dragging inside a panel updates both dimensions.
14. Large poster intermediates do not re-enable Sharp's default input pixel limit.
15. GUI export directories are deleted when the ZIP response finishes, closes, or fails.
16. The GUI performs conservative 24-hour stale cleanup on startup and hourly for crash recovery.
17. GUI export progress reflects actual CLI panel creation rather than only displaying an indeterminate animation.
18. Escape cancels an active modal export on both the browser and server and cleans up partial output.
19. Shared Winston logging defaults to debug, and CLI diagnostic logs do not interfere with stdout panel-progress parsing.
20. Export feedback appears only in the modal; the area below the ZIP button contains no status text.
21. The selected image filename and original pixel dimensions remain visible beneath the image picker.
22. Terminal modal states use the `Press Esc to close` hint instead of the generation-cancellation hint.
23. GUI styling keeps its Cricut-inspired green, charcoal, white, mint, and neutral visual system.
24. The CLI, GUI, and GUI server fallback use `#01a86b` as the default grid-line color.
25. The browser title uses `Ronyka Panel Splitter`; the heading beside the supplied Ronyka Piñatas logo uses `Panel Splitter`.
26. The GUI header displays the current application version in small text beneath the heading.
27. Switching the GUI unit system displays panel dimensions and limits plus the assembled-poster preview summary in centimeters or inches; poster height and grid width inputs remain in millimeters.
28. Imperial (`in`) is the default GUI display unit.
29. The assembled-poster preview summary displays poster dimensions on a separate line and labels their order as `(W × H)`.
30. Paper size and metric/imperial selection persist in browser local storage; other GUI settings and uploaded image data do not.
31. The `Panel Splitter` heading uses a rounded system-font stack rather than a proprietary Cricut font.
32. The heading uses bold weight and Cricut dark green.
33. Settings labels, values, controls, notes, and action text use the same rounded system-font family as the heading at font weight `500`.
34. The GUI does not expose a panel-number setting and its exports omit panel numbers; CLI numbering options remain supported.

## 17. Reconstructed version history

The repository did not previously contain release tags for these individual
changes. The versions below assign the implemented features to semantic,
feature-based milestones so future updates have a clear baseline.

### v1.0.0 — Core panel splitter

- Added the Node.js CLI, actual-pixel crop mode, Letter paper output, assembly
  guides, and left-to-right/top-to-bottom panel generation.

### v1.1.0 — Physical scaling and print metadata

- Added DPI metadata, target width/height scaling, margins, overlap, and
  explicit separation between actual-pixel and intentional scaling modes.

### v1.2.0 — Custom panel limits

- Added custom panel dimensions, portrait/landscape handling, US Legal support,
  and matching CLI/server validation for Letter and Legal limits.

### v1.3.0 — Transparency

- Preserved alpha through source decoding, resizing, cropping, partial panels,
  margins, and preview generation.

### v1.4.0 — Preview-only grids

- Added overlay and padding grid previews while keeping individual panel PNGs
  clean and leaving crop geometry unchanged.

### v1.5.0 — Panel numbering

- Added numbering from zero, inside-curve placement, center/top/bottom modes,
  readable number markers, fallbacks, and number-disable aliases.

### v1.6.0 — Local browser GUI

- Added Express/Multer GUI service, drag-and-drop uploads, live preview,
  physical controls, panel counts, and browser ZIP downloads.

### v1.7.0 — Interactive grid sizing

- Added draggable vertical/horizontal preview grid lines and diagonal
  interior-panel dragging with orientation-aware dimension clamping.

### v1.8.0 — Export lifecycle

- Added per-request temporary workspaces, ZIP streaming, immediate upload
  cleanup, and export-directory removal after response completion, close, or
  handled failure.

### v1.9.0 — Crash-recovery cleanup

- Added startup and hourly cleanup for app-owned temporary exports and uploads
  older than 24 hours.

### v1.10.0 — Large poster support

- Disabled Sharp's default input-pixel limit for poster-sized source and
  intermediate buffers, including the full-size grid composite.

### v1.11.0 — Live export progress

- Added export IDs, progress polling, real per-panel counts, ZIP/download
  phases, record expiry, and the blocking progress modal.

### v1.12.0 — Export cancellation

- Added Escape cancellation, server-side CLI termination, archive abort,
  partial-output cleanup, second-Escape dismissal, and terminal modal hints.

### v1.13.0 — Structured logging

- Added shared Winston logging for the CLI and GUI server, debug as the default
  level, `LOG_LEVEL` overrides, and stderr isolation for parseable CLI progress.

### v1.14.0 — GUI feedback cleanup

- Moved all export feedback into the modal, restored the dedicated selected
  image filename/pixel label, and removed status text below the export button.

### v1.15.0 — Cricut-inspired visual system

- Added the green/charcoal/white/mint GUI theme, corrected orientation-button
  interaction contrast, and set the default grid color to `#01a86b`.

### v1.16.0 — Ronyka branding

- Added the supplied Ronyka logo, `Ronyka Panel Splitter` browser title,
  `Panel Splitter` heading, and synchronized GUI version label.

### v1.17.0 — Units and preview summary

- Added centimeter/inch display for panel dimensions, limits, and poster
  summary; made imperial the default; retained millimeters for poster height
  and grid width; and placed poster `W × H` on its own line.

### v1.18.0 — Display preference persistence

- Persisted only paper size and metric/imperial selection in browser local
  storage under `ronyka-panel-splitter.display-settings.v1`.
- Restored preferences during GUI initialization while leaving all other GUI
  settings and uploaded images transient.

### v1.19.0 — Rounded branded heading

- Updated the `Panel Splitter` heading to use a bold rounded system-font stack
  in Cricut dark green without distributing a proprietary Cricut font.

### v1.20.0 — Unified settings typography

- Applied the rounded system-font family to settings labels, values, controls,
  notes, statistics, modal copy, and actions at font weight `500`.

### v1.21.0 — Simplified GUI exports

- Removed the panel-number setting and its unused frontend code and styles.
- GUI exports omit panel numbers while CLI numbering options remain available.

## 18. Recommended next improvements

These items were discussed or are natural next steps, but should not be assumed implemented:

- paired `*-print.png` and `*-cut.svg` exports;
- batch-oriented SVG manifest for non-Cricut cutters;
- authentication for public GUI access;
- upload-size and image-dimension limits;
- automated tests using synthetic transparent PNG fixtures;
- visual regression tests for panel boundaries and alpha preservation;
- end-to-end browser testing of ZIP export;
- selectable poster target width as well as height in the GUI;
- optional overlap visualization in the GUI;
- persistent named Cloudflare Tunnel configuration.
