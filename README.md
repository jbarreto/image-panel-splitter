# Ronyka Panel Splitter

A Node.js command-line tool that takes one large image, divides it into printable **US Letter** or **US Legal** pages, exports every page as a PNG, and draws an assembly number inside the largest enclosed area bounded by the artwork lines on every panel. By default, the source image is **not resized**: every original pixel is preserved.

The numbering runs from left to right and then top to bottom:

```text
0   1   2
3   4   5
6   7   8
```

## Requirements

- Node.js 20.9 or newer
- npm

## Install

```bash
npm install
```

## Install or update from GitHub

For a fresh installation on macOS or Linux, run:

```bash
curl -fsSL https://raw.githubusercontent.com/jbarreto/image-panel-splitter/main/scripts/install-update.mjs | node
```

This installs the application into `./ronyka-panel-splitter`.

For a fresh installation on Windows, run this native command in PowerShell:

```powershell
Invoke-RestMethod https://raw.githubusercontent.com/jbarreto/image-panel-splitter/main/scripts/install-update.mjs | node
```

This installs the application into `.\ronyka-panel-splitter`.

From an existing clone:

```bash
npm run update
```

The updater downloads the latest `main` source archive directly from GitHub,
updates the application files, and installs the exact dependencies from
`package-lock.json` with `npm ci`.

Because archive-based updates cannot inspect Git working-tree state, commit or
back up local code changes before updating. Application files that also exist
in the downloaded archive are replaced.

For a fresh installation on Windows or macOS, download
`scripts/install-update.mjs` and run it outside an existing clone, optionally
passing the install directory:

```bash
node install-update.mjs ./ronyka-panel-splitter
```

Requirements are npm and Node.js 20.9.0 or newer. Git is not required.

### Windows GUI launcher

Run `scripts\windows\start-ronyka-gui.bat` to check GitHub for a newer
published version, install it only when necessary, and start the GUI server in
a separate terminal. The launcher waits until the server responds before
opening `http://localhost:4173/` in the default browser. The server terminal
remains open so it can be used to inspect logs or stop the GUI.

## Basic usage — no scaling

```bash
node src/index.js /path/to/large-image.png \
  --fit actual \
  --output ./output
```

`--fit actual` is the default. The program does not resize the image. It only crops the original image into page-sized regions. The PNG panels will be written to `./output`.

## US Letter example

```bash
node src/index.js poster.png \
  --paper letter \
  --orientation portrait \
  --dpi 300 \
  --output ./letter-panels
```

## Print a one-meter-wide image

This preserves the image aspect ratio and scales its printed width to 1000 mm:

```bash
node src/index.js poster.png \
  --paper letter \
  --target-width-mm 1000 \
  --overlap-mm 5 \
  --output ./one-meter-poster
```

## Options

| Option | Meaning | Default |
|---|---|---:|
| `--output` | Output directory | `output` |
| `--paper` | `letter`, `legal`, or `custom`; also selects custom-panel limits | `letter` |
| `--number-style` | `badge` or plain outlined `plain` text | `badge` |
| `--orientation` | `portrait` or `landscape` | `portrait` |
| `--dpi` | Converts paper millimeters into page pixels and writes print-density metadata; it does not resize the source in `actual` mode | `300` |
| `--margin-mm` | White page margin | `5` |
| `--overlap-mm` | Repeated edge area for alignment | `0` |
| `--number-position` | `inside`, `center`, `top`, or `bottom` | `inside` |
| `--number-size-mm` | Center number height | `30` |
| `--number-size-px` | Exact output-pixel font size; overrides millimeters | unset |
| `--number-color` | CSS color used for number text | `black` |
| `--number-anchors-file` | JSON array of per-panel source-coordinate anchors | unset |
| `--panel-order-file` | JSON permutation of panel indexes in assembly order | unset |
| `--label-height-mm` | Label-strip height for top/bottom mode | `10` |
| `--fit` | `actual` preserves source pixels; `width` or `height` intentionally resizes | `actual` |
| `--target-width-mm` | Desired final printed image width; intentionally enables scaling | unset |
| `--target-height-mm` | Desired final printed image height | unset |
| `--prefix` | Panel filename prefix | `panel` |
| `--grid-lines` | Create `original-with-grid.png`; panel PNGs remain clean | disabled |
| `--grid-line-width-mm` | Grid-line thickness | `0.5` |
| `--grid-mode` | Preview style: `padding` inserts separators; `overlay` draws over preview | `padding` |
| `--grid-color` | SVG/CSS color used for the grid | `#01a86b` |
| `--no-number` | Disable printed panel numbers | false |
| `--no-label` | Alias for `--no-number` | false |

## Output

For each panel, the program creates a full-size paper PNG, such as:

```text
panel-0-r1-c1.png
panel-1-r1-c2.png
panel-2-r2-c1.png
assembly-guide.txt
assembly-guide.json
```

Each PNG has:

- The image section positioned inside the selected margin
- A number placed inside the largest enclosed white region bounded by dark painted lines, beginning at `0` and ending at `total panels - 1`
- A translucent white circle behind the number so it remains readable
- A fallback to the artwork centroid when a panel contains no fully enclosed curve
- DPI metadata for printing at actual size

## Important printing setting

Print the PNG files at **100%** or **Actual Size**. Disable **Fit to page**, because that option changes the dimensions and can make adjacent panels fail to align.

## Notes

- `--overlap-mm 5` is useful when trimming and taping large posters.
- With the default `--fit actual`, the source is never passed through a resize operation.
- The DPI determines how many pixels fit on a Letter/Legal page and the PNG print metadata. It does not alter source pixels.
- `--fit width`, `--fit height`, `--target-width-mm`, and `--target-height-mm` intentionally enable scaling. Do not use them when you require strict 1:1 pixels.
- Very large source images may require significant memory because the scaled image is kept in memory while panels are generated.

## Numbering inside painted curves

Placement inside an enclosed painted-line curve is the default:

```bash
node src/index.js poster.png --paper letter --number-position inside --output ./panels
```

For 12 panels, the program writes numbers `0` through `11`. Change their printed size with:

```bash
node src/index.js poster.png --number-size-mm 40
```

To force the number into the geometric center instead:

```bash
node src/index.js poster.png --number-position center
```

To use the label-strip layout instead:

```bash
node src/index.js poster.png --number-position bottom
```

## Cricut custom panel size

To export each PNG at exactly 9.26 × 6.55 inches for Cricut Design Space at 144 DPI:

```bash
node src/index.js input.png \
  --panel-width-in 9.26 \
  --panel-height-in 6.55 \
  --dpi 144 \
  --margin-mm 0 \
  --target-height-mm 1000 \
  --output ./panels
```

Do not combine `--fit actual` with a target physical size. A target width or height intentionally scales the complete assembled image to that physical size.

## Grid preview without changing poster panels

Use `--grid-lines` to create `original-with-grid.png`. Grid lines are written only to that preview file. Every exported poster panel is cropped from the clean artwork and contains no grid line.

```bash
node src/index.js input.png \
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

`--grid-mode padding` inserts separator strips only in the full preview. `--grid-mode overlay` draws the grid over the preview artwork. Neither mode changes panel dimensions, panel count, crop positions, or panel pixels.

## PNG transparency

The splitter preserves the alpha channel from transparent PNG inputs throughout the complete pipeline:

- transparent source pixels remain transparent after resizing or cropping;
- unused space on partial edge panels is transparent;
- page margins are transparent;
- the grid preview uses a transparent RGBA canvas;
- `original-with-grid.png` and all generated panel PNGs retain transparency;
- grid lines never appear in the generated panel PNGs.

Grid lines, labels, and number markers are intentional printed elements and remain opaque or semi-transparent according to their design.

## Local GUI

Install dependencies and launch the browser interface:

```bash
npm install
npm run gui
```

Then open `http://localhost:4173`.

The GUI supports image drag-and-drop, centimeter or inch display for panel dimensions and the preview summary, live sliders for panel width and height, draggable preview grid lines as an alternative way to adjust those dimensions, diagonal dragging anywhere inside a panel to adjust both dimensions together, a real-time grid preview, poster-height scaling, transparency preservation, and ZIP export. Imperial display is selected by default. Poster height and grid width inputs remain in millimeters. Grid lines appear only in `original-with-grid.png`; exported panel PNGs remain clean.

## Logging

The CLI and GUI server use Winston with debug logging enabled by default.
Set `LOG_LEVEL` to reduce or change verbosity:

```bash
LOG_LEVEL=info npm run gui
LOG_LEVEL=warn node src/index.js input.png
```

Supported Winston levels include `error`, `warn`, `info`, and `debug`.

## Custom panel limits

Custom panel dimensions depend on the selected paper size. The GUI sliders enforce these maximums, and both the CLI and GUI export endpoint reject larger values. Smaller values remain allowed.

### US Letter

- Landscape: maximum `9.26 × 6.55 in` (width × height)
- Portrait: maximum `6.55 × 9.26 in` (width × height)

### US Legal

- Landscape: maximum `11.84 × 6.76 in` (width × height)
- Portrait: maximum `6.76 × 11.84 in` (width × height)

### Custom

Select `Custom` in the GUI to set panel width and height freely, up to
`100 × 100 in`. In the CLI, use `--paper custom` together with both
`--panel-width-in` and `--panel-height-in`.

The GUI updates the slider maximums when the paper size or orientation changes. The CLI and GUI export endpoint enforce the same mappings.

## Automatic mixed-orientation layout

After loading an image, toggle **Auto paneling** on to generate an
artwork-aware layout; toggle it off to restore the uniform grid. The generator detects visible artwork against
transparency or a plain corner-matched background, omits empty canvas regions,
and chooses portrait or landscape independently for each sheet.
The **Manual paneling** subsection—orientation, width, and height—collapses out
of view while Auto paneling is enabled and returns when it is disabled.
Automatic panels choose portrait or landscape independently.
**Maximum panel side** replaces Panel width and Panel height for automatic
layouts. Its maximum is the selected paper profile's longest printable side;
the automatic short side is capped by the paper's shorter printable limit. Its
minimum is `0.75 in`.
Manual Panel width/height changes do not alter Maximum panel side or Minimum
panel side.
Changing Paper size resets Maximum panel side to that profile's longest
printable dimension.
For Custom paper, Maximum panel side allows up to `100 in` but resets to a
default selected value of `9.26 in`.
The enable toggle, maximum side, and minimum-size sliders are grouped together
in the **Auto paneling** subsection of Panel Layout.
When Auto paneling is off, its sizing options collapse; enabling it slides and
fades those controls into view.
The saved toggle state applies this disclosure immediately when the website
starts, even before an image is selected.
Panel orientation, Panel width, and Panel height are grouped in the neighboring
**Manual paneling** subsection. Loading a new image resets Panel width and
Panel height to the selected paper and orientation's maximum values.
Use **Minimum panel side** to prevent undersized automatic panel crops in
either dimension. It defaults to its allowed minimum of `0.25 in` for every
new image and follows the selected metric or imperial unit system. It appears
at the same level as Maximum panel side inside
Auto paneling and can reach the selected paper profile's longest side. Raising
it above Maximum panel side raises the maximum to match; lowering Maximum panel
side below it lowers the minimum. The minimum must permit a non-overlapping
partition. If it does not, the GUI shows an inline explanation and keeps the
previous valid grid.

This uses a deterministic artwork-aware partitioning algorithm. It aims to
reduce the number of sheets, but arbitrary-shape rectangle partitioning is
computationally hard, so the result is an optimized layout rather than a
guaranteed global minimum. Generated regions never overlap, so a source-image
segment cannot be repeated across exported panels. The preview rectangles,
exported PNG panels, grid preview, and assembly guide all use the same layout.
While the toggle remains on, changing panel dimensions, DPI, poster height,
or paper size automatically recalculates the layout. The enabled orientation
control sets the preferred/base orientation, while automatic mode may choose
portrait or landscape separately for each generated panel. Press `Shift+A`
outside an input control to toggle automatic mode from the keyboard.

When **Print Panel Numbers** is toggled on, each number can
be dragged independently in the preview. Its source-canvas position is clamped
inside that panel, passed to export, recorded in the assembly guide, and drawn
at the same location in `original-with-grid.png`. A number is normally rendered
at 50% opacity, then becomes fully opaque and bold while hovered or dragged to
identify the active target. The toggle state is restored from browser local
storage on refresh. The preview keeps numbers at the selected visible size and
calculates the equivalent output-pixel font size from the poster preview scale,
preserving the same relative size in exported images.

Panel numbers use reading order: left to right across each row, then top to
bottom. Automatic mixed-orientation layouts cluster panels with nearby top
edges into visual rows using the stable full printable page height rather than
the variable trimmed artwork height. Each row is then sorted left-to-right, so
small vertical offsets do not produce unnatural numbering. Preview numbering,
filenames, and assembly guides use the same order.

To override that starting order, select **Edit Assembly Order** and click
panels in the desired `0, 1, 2, …` sequence. Finishing early keeps all unclicked
panels in their previous relative order. **Reset Order** restores the automatic
spatial order. Custom order is applied consistently to preview numbers, manual
number anchors, filenames, panel PNGs, `original-with-grid.png`, and both
assembly guides. Press `Shift+O` to start or finish assembly-order editing.

Press `Ctrl+Enter` on Windows/Linux or `Cmd+Enter` on macOS to export the
panels ZIP.

The **Preview** settings group includes a **Floating preview** toggle. It is
enabled by default so the preview follows page scrolling while settings are
adjusted. Disable it to leave the preview in its normal document position. The
choice is saved in browser local storage.

The predefined number-size settings are **Small** (14 px), **Medium** (20 px),
and **Large** (28 px). Auto paneling, its maximum and minimum sides,
paper size, unit system, Poster height, Floating preview, Print Panel Numbers,
and the selected number-size preset are saved in browser local storage.

For large numbered posters, grid lines and centered/manual numbers are rendered
together in a single full-poster pass before panel generation. This avoids a
second full-resolution composite after the final panel.

GUI export progress distinguishes source decoding, full-poster scaling, layout
calculation, full-grid preview rendering, panel generation, ZIP creation, and
download. The grid-preview phase displays the calculated panel count.
