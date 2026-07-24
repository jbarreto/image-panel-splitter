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
| `--orientation` | `portrait` or `landscape` | `portrait` |
| `--dpi` | Converts paper millimeters into page pixels and writes print-density metadata; it does not resize the source in `actual` mode | `300` |
| `--margin-mm` | White page margin | `5` |
| `--overlap-mm` | Repeated edge area for alignment | `0` |
| `--number-position` | `inside`, `center`, `top`, or `bottom` | `inside` |
| `--number-size-mm` | Center number height | `30` |
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

After loading an image, toggle **Auto minimize panels** on to generate an
artwork-aware layout; toggle it off to restore the uniform grid. The generator detects visible artwork against
transparency or a plain corner-matched background, omits empty canvas regions,
and chooses portrait or landscape independently for each sheet.

This uses a deterministic artwork-aware partitioning algorithm. It aims to
reduce the number of sheets, but arbitrary-shape rectangle partitioning is
computationally hard, so the result is an optimized layout rather than a
guaranteed global minimum. Generated regions never overlap, so a source-image
segment cannot be repeated across exported panels. The preview rectangles,
exported PNG panels, grid preview, and assembly guide all use the same layout.
