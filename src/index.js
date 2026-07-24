#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import logger from './logger.js';

const PAPER_SIZES_MM = {
  letter: { width: 215.9, height: 279.4, displayName: 'US Letter' },
  legal: { width: 215.9, height: 355.6, displayName: 'US Legal' }
};

const PANEL_LIMITS_IN = {
  letter: { landscape: { width: 9.26, height: 6.55 }, portrait: { width: 6.55, height: 9.26 } },
  legal: { landscape: { width: 11.84, height: 6.76 }, portrait: { width: 6.76, height: 11.84 } }
};

function printHelp() {
  console.log(`
Image Panel Splitter

Usage:
  node src/index.js <input-image> [options]

Options:
  --output <directory>       Output directory (default: ./output)
  --paper <letter|legal>     Paper size and custom-panel limit profile (default: letter)
  --panel-width-in <number>  Exact exported panel width in inches
  --panel-height-in <number> Exact exported panel height in inches
  --orientation <portrait|landscape>
                             Panel orientation (default: portrait)
  --dpi <number>             Print resolution (default: 300)
  --margin-mm <number>       Transparent outer margin on every page (default: 5)
  --overlap-mm <number>      Repeated image overlap between panels (default: 0)
  --number-position <inside|center|bottom|top>
                             'inside' places the number inside the largest enclosed
                             white region bounded by painted lines (default: inside)
  --label-height-mm <number> Label strip height for top/bottom mode (default: 10)
  --number-size-mm <number>  Centered number height (default: 30)
  --fit <actual|width|height>
                             Scaling mode. 'actual' preserves every source pixel
                             without resizing (default: actual)
  --target-width-mm <number> Printed image width; implies custom scaling
  --target-height-mm <number>
                             Printed image height; implies custom scaling
  --prefix <text>            Output filename prefix (default: panel)
  --grid-lines               Draw the complete panel grid before slicing
  --grid-line-width-mm <n>   Grid line thickness (default: 0.5)
  --grid-mode <padding|overlay>
                             padding reserves space so artwork is not covered
                             (default: padding); overlay draws over artwork
  --grid-color <css-color>   Grid line color (default: black)
  --no-number                Do not draw panel numbers
  --no-label                 Alias for --no-number
  --help                     Show this help

Examples:
  node src/index.js poster.png --paper letter --dpi 300
  node src/index.js poster.png --paper letter --orientation landscape --overlap-mm 5
  node src/index.js poster.png --target-width-mm 1000 --output ./poster-panels
`);
}

function parseArgs(argv) {
  const options = {
    output: 'output',
    paper: 'letter',
    orientation: 'portrait',
    dpi: 300,
    marginMm: 5,
    overlapMm: 0,
    labelHeightMm: 10,
    numberPosition: 'inside',
    numberSizeMm: 30,
    fit: 'actual',
    prefix: 'panel',
    label: true,
    gridLines: false,
    gridLineWidthMm: 0.5,
    gridMode: 'padding',
    gridColor: 'black',
    targetWidthMm: undefined,
    targetHeightMm: undefined,
    panelWidthIn: undefined,
    panelHeightIn: undefined
  };

  let input;
  const valueOptions = new Map([
    ['--output', 'output'],
    ['--paper', 'paper'],
    ['--orientation', 'orientation'],
    ['--dpi', 'dpi'],
    ['--margin-mm', 'marginMm'],
    ['--overlap-mm', 'overlapMm'],
    ['--label-height-mm', 'labelHeightMm'],
    ['--number-position', 'numberPosition'],
    ['--label-position', 'numberPosition'],
    ['--number-size-mm', 'numberSizeMm'],
    ['--fit', 'fit'],
    ['--target-width-mm', 'targetWidthMm'],
    ['--target-height-mm', 'targetHeightMm'],
    ['--panel-width-in', 'panelWidthIn'],
    ['--panel-height-in', 'panelHeightIn'],
    ['--prefix', 'prefix'],
    ['--grid-line-width-mm', 'gridLineWidthMm'],
    ['--grid-mode', 'gridMode'],
    ['--grid-color', 'gridColor']
  ]);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--no-number' || arg === '--no-label') {
      options.label = false;
      continue;
    }
    if (arg === '--grid-lines') {
      options.gridLines = true;
      continue;
    }
    if (arg === '--no-grid-lines') {
      options.gridLines = false;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = valueOptions.get(arg);
      if (!key) throw new Error(`Unknown option: ${arg}`);
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      options[key] = value;
      continue;
    }
    if (!input) input = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }

  for (const key of ['dpi', 'marginMm', 'overlapMm', 'labelHeightMm', 'numberSizeMm', 'targetWidthMm', 'targetHeightMm', 'panelWidthIn', 'panelHeightIn', 'gridLineWidthMm']) {
    if (options[key] !== undefined) {
      options[key] = Number(options[key]);
      if (!Number.isFinite(options[key]) || options[key] < 0) {
        throw new Error(`${key} must be a non-negative number.`);
      }
    }
  }

  options.paper = String(options.paper).toLowerCase();
  options.orientation = String(options.orientation).toLowerCase();
  options.numberPosition = String(options.numberPosition).toLowerCase();
  options.fit = String(options.fit).toLowerCase();
  options.gridMode = String(options.gridMode).toLowerCase();

  if (!input) throw new Error('An input image is required.');
  if (!PAPER_SIZES_MM[options.paper]) throw new Error('--paper must be letter or legal.');
  if (!['portrait', 'landscape'].includes(options.orientation)) {
    throw new Error('--orientation must be portrait or landscape.');
  }
  if (!['inside', 'center', 'top', 'bottom'].includes(options.numberPosition)) {
    throw new Error('--number-position must be inside, center, top, or bottom.');
  }
  if (!['actual', 'width', 'height'].includes(options.fit)) {
    throw new Error('--fit must be actual, width, or height.');
  }
  if (!['padding', 'overlay'].includes(options.gridMode)) {
    throw new Error('--grid-mode must be padding or overlay.');
  }
  if (options.dpi <= 0) throw new Error('--dpi must be greater than zero.');
  if ((options.panelWidthIn === undefined) !== (options.panelHeightIn === undefined)) {
    throw new Error('--panel-width-in and --panel-height-in must be used together.');
  }
  if (options.panelWidthIn !== undefined && (options.panelWidthIn <= 0 || options.panelHeightIn <= 0)) {
    throw new Error('Custom panel dimensions must be greater than zero.');
  }
  if (options.panelWidthIn !== undefined) {
    const { width: maxWidth, height: maxHeight } = PANEL_LIMITS_IN[options.paper][options.orientation];
    if (options.panelWidthIn > maxWidth) {
      throw new Error(`For ${options.paper} ${options.orientation}, --panel-width-in cannot exceed ${maxWidth}.`);
    }
    if (options.panelHeightIn > maxHeight) {
      throw new Error(`For ${options.paper} ${options.orientation}, --panel-height-in cannot exceed ${maxHeight}.`);
    }
  }
  return { input, options };
}

function mmToPixels(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

// Poster-sized intermediates can legitimately exceed Sharp's default
// 268-megapixel input safety limit. The source and every intermediate image
// are opened through this helper so re-reading an encoded buffer does not
// accidentally restore that default limit.
function openImage(input) {
  return sharp(input, { limitInputPixels: false });
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function makeLabelSvg(width, height, label, fontSize) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <line x1="0" y1="1" x2="${width}" y2="1" stroke="black" stroke-width="2"/>
      <text x="${Math.round(width / 2)}" y="${Math.round(height / 2)}"
        dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}"
        font-weight="700" fill="black">${escapeXml(label)}</text>
    </svg>
  `);
}


function makeNumberSvg(width, height, number, fontSize, centerX, centerY) {
  centerX = Math.round(centerX);
  centerY = Math.round(centerY);
  const circleRadius = Math.round(fontSize * 0.72);
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${centerX}" cy="${centerY}" r="${circleRadius}"
        fill="white" fill-opacity="0.82" stroke="black" stroke-width="${Math.max(2, Math.round(fontSize * 0.045))}"/>
      <text x="${centerX}" y="${centerY}"
        dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}"
        font-weight="700" fill="black">${escapeXml(number)}</text>
    </svg>
  `);
}




function makeGridSvg(width, height, verticalLines, horizontalLines, strokeWidth, color) {
  const vertical = verticalLines
    .map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`)
    .join('\n');
  const horizontal = horizontalLines
    .map((y) => `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`)
    .join('\n');

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="${escapeXml(color)}" stroke-width="${strokeWidth}"
         stroke-linecap="square" shape-rendering="crispEdges">
        ${vertical}
        ${horizontal}
      </g>
    </svg>
  `);
}

function makeGridPaddingTile(tileBuffer, contentWidth, contentHeight, outputWidth, outputHeight, lineWidth, color, drawRight, drawBottom) {
  const composites = [{ input: tileBuffer, left: 0, top: 0 }];
  if (drawRight && lineWidth > 0) {
    composites.push({
      input: {
        create: { width: lineWidth, height: outputHeight, channels: 4, background: color }
      },
      left: contentWidth,
      top: 0
    });
  }
  if (drawBottom && lineWidth > 0) {
    composites.push({
      input: {
        create: { width: outputWidth, height: lineWidth, channels: 4, background: color }
      },
      left: 0,
      top: contentHeight
    });
  }
  return sharp({
    create: { width: outputWidth, height: outputHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite(composites).png().toBuffer();
}

async function findInsideNumberPosition(tileBuffer, width, height, fontSize) {
  // Analyze a reduced grayscale copy. White regions connected to an edge are
  // background; remaining white components are enclosed by dark artwork lines.
  const maxAnalysisSide = 900;
  const scale = Math.min(1, maxAnalysisSide / Math.max(width, height));
  const analysisWidth = Math.max(1, Math.round(width * scale));
  const analysisHeight = Math.max(1, Math.round(height * scale));
  const { data } = await openImage(tileBuffer)
    .resize(analysisWidth, analysisHeight, { fit: 'fill', kernel: 'nearest' })
    .flatten({ background: 'white' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = analysisWidth * analysisHeight;
  const isWhite = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) isWhite[i] = data[i] >= 238 ? 1 : 0;

  const exterior = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (!isWhite[index] || exterior[index]) return;
    exterior[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < analysisWidth; x += 1) {
    enqueue(x);
    enqueue((analysisHeight - 1) * analysisWidth + x);
  }
  for (let y = 0; y < analysisHeight; y += 1) {
    enqueue(y * analysisWidth);
    enqueue(y * analysisWidth + analysisWidth - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % analysisWidth;
    const y = Math.floor(index / analysisWidth);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < analysisWidth) enqueue(index + 1);
    if (y > 0) enqueue(index - analysisWidth);
    if (y + 1 < analysisHeight) enqueue(index + analysisWidth);
  }

  const visited = new Uint8Array(pixelCount);
  const componentQueue = new Int32Array(pixelCount);
  const components = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (!isWhite[start] || exterior[start] || visited[start]) continue;
    let componentHead = 0;
    let componentTail = 0;
    componentQueue[componentTail++] = start;
    visited[start] = 1;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = analysisWidth;
    let maxX = 0;
    let minY = analysisHeight;
    let maxY = 0;

    while (componentHead < componentTail) {
      const index = componentQueue[componentHead++];
      const x = index % analysisWidth;
      const y = Math.floor(index / analysisWidth);
      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < analysisWidth) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - analysisWidth);
      if (y + 1 < analysisHeight) neighbors.push(index + analysisWidth);
      for (const next of neighbors) {
        if (isWhite[next] && !exterior[next] && !visited[next]) {
          visited[next] = 1;
          componentQueue[componentTail++] = next;
        }
      }
    }

    components.push({ count, sumX, sumY, minX, maxX, minY, maxY });
  }

  const requiredDiameter = Math.max(12, fontSize * 1.55 * scale);
  const candidates = components
    .filter((component) =>
      component.maxX - component.minX + 1 >= requiredDiameter &&
      component.maxY - component.minY + 1 >= requiredDiameter
    )
    .sort((a, b) => b.count - a.count);

  if (candidates.length > 0) {
    const region = candidates[0];
    return {
      x: (region.sumX / region.count) / scale,
      y: (region.sumY / region.count) / scale,
      strategy: 'largest-enclosed-region'
    };
  }

  // Fallback: center the label on the artwork's dark-pixel centroid.
  let darkCount = 0;
  let darkX = 0;
  let darkY = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    if (data[i] < 220) {
      darkCount += 1;
      darkX += i % analysisWidth;
      darkY += Math.floor(i / analysisWidth);
    }
  }
  if (darkCount > 0) {
    return {
      x: (darkX / darkCount) / scale,
      y: (darkY / darkCount) / scale,
      strategy: 'artwork-centroid'
    };
  }

  return { x: width / 2, y: height / 2, strategy: 'panel-center' };
}

function calculateScaledDimensions(metadata, options, printableWidth, printableHeight) {
  const sourceWidth = metadata.width;
  const sourceHeight = metadata.height;
  if (!sourceWidth || !sourceHeight) throw new Error('Could not determine input image dimensions.');

  if (options.targetWidthMm || options.targetHeightMm) {
    if (options.targetWidthMm && options.targetHeightMm) {
      return {
        width: mmToPixels(options.targetWidthMm, options.dpi),
        height: mmToPixels(options.targetHeightMm, options.dpi)
      };
    }
    if (options.targetWidthMm) {
      const width = mmToPixels(options.targetWidthMm, options.dpi);
      return { width, height: Math.round(width * sourceHeight / sourceWidth) };
    }
    const height = mmToPixels(options.targetHeightMm, options.dpi);
    return { width: Math.round(height * sourceWidth / sourceHeight), height };
  }

  if (options.fit === 'width') {
    const width = printableWidth;
    return { width, height: Math.round(width * sourceHeight / sourceWidth) };
  }
  if (options.fit === 'height') {
    const height = printableHeight;
    return { width: Math.round(height * sourceWidth / sourceHeight), height };
  }

  return { width: sourceWidth, height: sourceHeight };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const { input, options } = parsed;
  const inputPath = path.resolve(input);
  const outputDir = path.resolve(options.output);
  logger.debug('Starting image split.', { inputPath, outputDir });
  await fs.access(inputPath);
  await fs.mkdir(outputDir, { recursive: true });

  let paper;
  if (options.panelWidthIn !== undefined) {
    paper = {
      width: options.panelWidthIn * 25.4,
      height: options.panelHeightIn * 25.4,
      displayName: `Custom ${options.panelWidthIn} × ${options.panelHeightIn} in`
    };
  } else {
    paper = { ...PAPER_SIZES_MM[options.paper] };
    if (options.orientation === 'landscape') {
      paper = { ...paper, width: paper.height, height: paper.width };
    }
  }

  const pageWidth = mmToPixels(paper.width, options.dpi);
  const pageHeight = mmToPixels(paper.height, options.dpi);
  const margin = mmToPixels(options.marginMm, options.dpi);
  const usesLabelStrip = options.label && !['center', 'inside'].includes(options.numberPosition);
  const labelHeight = usesLabelStrip ? mmToPixels(options.labelHeightMm, options.dpi) : 0;
  const overlap = mmToPixels(options.overlapMm, options.dpi);
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2 - labelHeight;

  if (printableWidth <= 0 || printableHeight <= 0) {
    throw new Error('Margins and label area leave no printable image area.');
  }
  if (overlap >= printableWidth || overlap >= printableHeight) {
    throw new Error('Overlap must be smaller than the printable width and height.');
  }

  const source = openImage(inputPath).rotate().ensureAlpha();
  const sourceImage = await source.png().toBuffer();
  const metadata = await openImage(sourceImage).metadata();
  logger.debug('Source image decoded.', {
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels
  });
  const scaled = calculateScaledDimensions(metadata, options, printableWidth, printableHeight);

  const scalingRequested =
    options.fit !== 'actual' ||
    options.targetWidthMm !== undefined ||
    options.targetHeightMm !== undefined;

  // In actual mode, do not call resize at all. Each source pixel is copied
  // unchanged into exactly one page crop (or repeated only by overlap).
  const baseWorkingImage = scalingRequested
    ? await openImage(sourceImage)
        .resize(scaled.width, scaled.height, { fit: 'fill' })
        .png()
        .toBuffer()
    : sourceImage;
  logger.debug('Working image prepared.', {
    scalingRequested,
    width: scaled.width,
    height: scaled.height
  });

  const gridWidthPx = options.gridLines
    ? Math.max(1, mmToPixels(options.gridLineWidthMm, options.dpi))
    : 0;
  // Grid lines are preview-only. They never consume space in or alter exported panels.
  const contentWidth = printableWidth;
  const contentHeight = printableHeight;
  if (contentWidth <= 0 || contentHeight <= 0) {
    throw new Error('Grid line is too thick for the selected panel dimensions.');
  }

  const stepX = contentWidth - overlap;
  const stepY = contentHeight - overlap;
  const columns = Math.max(1, Math.ceil((scaled.width - overlap) / stepX));
  const rows = Math.max(1, Math.ceil((scaled.height - overlap) / stepY));
  logger.debug('Panel grid calculated.', { rows, columns, total: rows * columns });

  // Build a separate grid preview. Exported panels always come from baseWorkingImage.
  if (options.gridLines && options.gridMode === 'overlay') {
    logger.debug('Generating overlay grid preview.');
    const verticalLines = [0];
    const horizontalLines = [0];
    for (let column = 1; column < columns; column += 1) {
      verticalLines.push(Math.min(scaled.width - 1, column * stepX));
    }
    for (let row = 1; row < rows; row += 1) {
      horizontalLines.push(Math.min(scaled.height - 1, row * stepY));
    }
    verticalLines.push(Math.max(0, scaled.width - 1));
    horizontalLines.push(Math.max(0, scaled.height - 1));

    const gridSvg = makeGridSvg(
      scaled.width,
      scaled.height,
      [...new Set(verticalLines)],
      [...new Set(horizontalLines)],
      gridWidthPx,
      options.gridColor
    );
    const gridPreviewImage = await openImage(baseWorkingImage)
      .composite([{ input: gridSvg, left: 0, top: 0, limitInputPixels: false }])
      .png()
      .toBuffer();

    await openImage(gridPreviewImage)
      .png({ compressionLevel: 9 })
      .withMetadata({ density: options.dpi })
      .toFile(path.join(outputDir, 'original-with-grid.png'));
  } else if (options.gridLines && options.gridMode === 'padding') {
    logger.debug('Generating padded grid preview.');
    const previewWidth = scaled.width + Math.max(0, columns - 1) * gridWidthPx;
    const previewHeight = scaled.height + Math.max(0, rows - 1) * gridWidthPx;
    const previewComposites = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const left = column * stepX;
        const top = row * stepY;
        const cropWidth = Math.min(contentWidth, scaled.width - left);
        const cropHeight = Math.min(contentHeight, scaled.height - top);
        const crop = await openImage(baseWorkingImage)
          .extract({ left, top, width: cropWidth, height: cropHeight })
          .png()
          .toBuffer();
        previewComposites.push({
          input: crop,
          left: column * (contentWidth + gridWidthPx),
          top: row * (contentHeight + gridWidthPx)
        });
      }
    }
    for (let column = 1; column < columns; column += 1) {
      previewComposites.push({
        input: { create: { width: gridWidthPx, height: previewHeight, channels: 4, background: options.gridColor } },
        left: column * contentWidth + (column - 1) * gridWidthPx,
        top: 0
      });
    }
    for (let row = 1; row < rows; row += 1) {
      previewComposites.push({
        input: { create: { width: previewWidth, height: gridWidthPx, channels: 4, background: options.gridColor } },
        left: 0,
        top: row * contentHeight + (row - 1) * gridWidthPx
      });
    }
    await sharp({
      create: { width: previewWidth, height: previewHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite(previewComposites)
      .png({ compressionLevel: 9 })
      .withMetadata({ density: options.dpi })
      .toFile(path.join(outputDir, 'original-with-grid.png'));
  }
  const total = rows * columns;
  const lastPanelNumber = total - 1;
  const digits = Math.max(1, String(lastPanelNumber).length);
  const manifest = [];

  console.log(`Input: ${metadata.width} × ${metadata.height} px`);
  console.log(
    scalingRequested
      ? `Scaled: ${scaled.width} × ${scaled.height} px`
      : `Scale: unchanged (1 source pixel = 1 output image pixel)`
  );
  console.log(`Paper: ${paper.displayName}, ${options.orientation}, ${options.dpi} DPI`);
  console.log(`Grid: ${rows} row(s) × ${columns} column(s) = ${total} panel(s)`);
  if (options.gridLines) {
    console.log(`Grid lines: ${options.gridLineWidthMm} mm, ${options.gridColor}, mode=${options.gridMode}`);
  }

  let panelNumber = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = column * stepX;
      const top = row * stepY;
      const cropWidth = Math.min(contentWidth, scaled.width - left);
      const cropHeight = Math.min(contentHeight, scaled.height - top);
      const numberText = String(panelNumber).padStart(digits, '0');
      const positionText = `R${row + 1} C${column + 1}`;
      const label = `Panel ${numberText} of ${lastPanelNumber}  •  ${positionText}`;
      const filename = `${options.prefix}-${numberText}-r${row + 1}-c${column + 1}.png`;

      const rawTile = await openImage(baseWorkingImage)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .extend({
          top: 0,
          left: 0,
          right: contentWidth - cropWidth,
          bottom: contentHeight - cropHeight,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      const tile = rawTile;

      const imageTop = options.numberPosition === 'top' ? margin + labelHeight : margin;
      const composites = [{ input: tile, left: margin, top: imageTop }];

      if (options.label && ['center', 'inside'].includes(options.numberPosition)) {
        const fontSize = Math.max(24, mmToPixels(options.numberSizeMm, options.dpi));
        const placement = options.numberPosition === 'inside'
          ? await findInsideNumberPosition(tile, printableWidth, printableHeight, fontSize)
          : { x: printableWidth / 2, y: printableHeight / 2, strategy: 'panel-center' };
        const numberSvg = makeNumberSvg(
          printableWidth,
          printableHeight,
          numberText,
          fontSize,
          placement.x,
          placement.y
        );
        composites.push({ input: numberSvg, left: margin, top: imageTop });
      } else if (options.label) {
        const labelSvg = makeLabelSvg(
          printableWidth,
          labelHeight,
          label,
          Math.max(18, Math.round(labelHeight * 0.34))
        );
        const labelTop = options.numberPosition === 'top' ? margin : margin + printableHeight;
        composites.push({ input: labelSvg, left: margin, top: labelTop });
      }

      await sharp({
        create: {
          width: pageWidth,
          height: pageHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
        .composite(composites)
        .png({ compressionLevel: 9 })
        .withMetadata({ density: options.dpi })
        .toFile(path.join(outputDir, filename));

      manifest.push({
        panel: panelNumber,
        row: row + 1,
        column: column + 1,
        filename,
        sourceCropPx: { left, top, width: cropWidth, height: cropHeight }
      });
      console.log(`Created ${filename}`);
      panelNumber += 1;
    }
  }

  const guide = {
    input: inputPath,
    sourcePixels: { width: metadata.width, height: metadata.height },
    outputImagePixels: scaled,
    scalingApplied: scalingRequested,
    transparencyPreserved: true,
    paper: {
      type: options.panelWidthIn !== undefined ? 'custom' : options.paper,
      name: paper.displayName,
      orientation: options.orientation,
      widthMm: paper.width,
      heightMm: paper.height,
      dpi: options.dpi,
      pagePixels: { width: pageWidth, height: pageHeight }
    },
    layout: {
      rows,
      columns,
      totalPanels: total,
      marginMm: options.marginMm,
      overlapMm: options.overlapMm,
      numberPosition: options.numberPosition,
      numberSizeMm: options.label && ['center', 'inside'].includes(options.numberPosition) ? options.numberSizeMm : 0,
      labelHeightMm: usesLabelStrip ? options.labelHeightMm : 0,
      numbering: 'Left to right, then top to bottom',
      gridLines: options.gridLines,
      gridLineWidthMm: options.gridLines ? options.gridLineWidthMm : 0,
      gridMode: options.gridLines ? options.gridMode : null,
      gridOutput: options.gridLines ? 'original-with-grid.png only' : null,
      contentPixelsPerPanel: { width: contentWidth, height: contentHeight },
      gridColor: options.gridLines ? options.gridColor : null
    },
    panels: manifest
  };

  await fs.writeFile(
    path.join(outputDir, 'assembly-guide.json'),
    `${JSON.stringify(guide, null, 2)}\n`,
    'utf8'
  );

  const textGuide = [
    'IMAGE PANEL ASSEMBLY GUIDE',
    '==========================',
    `Grid: ${rows} rows × ${columns} columns`,
    `Numbering: left to right, then top to bottom`,
    '',
    ...Array.from({ length: rows }, (_, row) =>
      Array.from({ length: columns }, (_, col) => {
        const n = row * columns + col;
        return String(n).padStart(digits, '0');
      }).join('   ')
    ),
    '',
    `Print each PNG at 100% / Actual Size. Do not use “Fit to page.”`,
    options.overlapMm > 0
      ? `Adjacent panels repeat ${options.overlapMm} mm for alignment.`
      : 'No overlap was added between panels.',
    ''
  ].join('\n');

  await fs.writeFile(path.join(outputDir, 'assembly-guide.txt'), textGuide, 'utf8');
  logger.info('Image split completed.', { outputDir, panels: total });
  console.log(`\nDone. Files saved in: ${outputDir}`);
}

main().catch((error) => {
  logger.error('Image split failed.', { error: error.message, stack: error.stack });
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
