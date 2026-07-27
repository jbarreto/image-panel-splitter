import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const PotraceBitmap = require('oslllo-potrace/src/types/Bitmap');
const PotraceProcessor = require('oslllo-potrace/src/processor');
const PotraceSvg = require('oslllo-potrace/src/svg');

const TRACE_OPTIONS = {
  turnpolicy: 'minority',
  turdsize: 2,
  optcurve: true,
  alphamax: 1,
  opttolerance: 0.2,
  svgSize: 1,
  opt_type: undefined
};

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error('Vectorization canceled.');
  error.name = 'AbortError';
  throw error;
}

function traceOptions(curveSmoothing) {
  const smoothing = Math.max(0, Math.min(100, curveSmoothing));
  const alphamax = smoothing <= 50
    ? smoothing / 50
    : 1 + (smoothing - 50) / 150;
  const opttolerance = smoothing <= 50
    ? 0.02 + 0.18 * smoothing / 50
    : 0.2 + 0.8 * (smoothing - 50) / 50;
  return {
    ...TRACE_OPTIONS,
    alphamax,
    opttolerance
  };
}

function validateOptions({
  targetHeightMm,
  threshold,
  maximumTraceSide,
  curveSmoothing,
  mode,
  svgStructure,
  colorCount
}) {
  if (!Number.isFinite(targetHeightMm) || targetHeightMm <= 0 || targetHeightMm > 100000) {
    throw new Error('Artwork height must be between 0 and 100000 mm.');
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 254) {
    throw new Error('Threshold must be an integer between 1 and 254.');
  }
  if (!['monochrome', 'multicolor'].includes(mode)) {
    throw new Error('Vector mode must be monochrome or multicolor.');
  }
  if (!['groups', 'corel', 'flat'].includes(svgStructure)) {
    throw new Error('SVG structure must be groups, corel, or flat.');
  }
  if (!Number.isInteger(colorCount) || colorCount < 2 || colorCount > 33) {
    throw new Error('Color count must be between 2 and 33.');
  }
  if (
    !Number.isInteger(maximumTraceSide) ||
    maximumTraceSide < 500 ||
    maximumTraceSide > 20000
  ) {
    throw new Error('Trace resolution must be between 500 and 20000 pixels.');
  }
  if (
    !Number.isInteger(curveSmoothing) ||
    curveSmoothing < 0 ||
    curveSmoothing > 100
  ) {
    throw new Error('Curve smoothing must be between 0 and 100.');
  }
}

async function smoothTraceMask(mask, width, height, curveSmoothing) {
  if (curveSmoothing <= 50) return mask;
  const strength = (curveSmoothing - 50) / 50;
  const sigma = Math.max(0.3, strength * 6);
  const pixels = Buffer.allocUnsafe(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    pixels[index] = mask[index] ? 255 : 0;
  }
  const smoothed = await sharp(pixels, {
    raw: { width, height, channels: 1 }
  })
    .blur(sigma)
    .threshold(128)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const result = new Int8Array(smoothed.length);
  for (let index = 0; index < smoothed.length; index += 1) {
    result[index] = smoothed[index] >= 128 ? 1 : 0;
  }
  return result;
}

async function traceMask(mask, width, height, curveSmoothing) {
  const traceableMask = await smoothTraceMask(mask, width, height, curveSmoothing);
  const options = traceOptions(curveSmoothing);
  const bitmap = new PotraceBitmap(width, height, options);
  bitmap.data.set(traceableMask);
  const paths = [];
  bitmap.pathlist(paths);
  if (paths.length === 0) return '';
  const processor = new PotraceProcessor(options, paths);
  processor.init();
  const svg = new PotraceSvg(options, paths, bitmap).get();
  return svg.match(/<path\b[^>]*\bd="([^"]*)"/i)?.[1] || '';
}

function colorDistance(first, second) {
  return (
    (first.r - second.r) ** 2 +
    (first.g - second.g) ** 2 +
    (first.b - second.b) ** 2
  );
}

function buildPalette(data, colorCount) {
  const histogram = new Map();
  const pixelCount = data.length / 4;
  const sampleStep = Math.max(1, Math.floor(pixelCount / 50000));
  for (let pixel = 0; pixel < pixelCount; pixel += sampleStep) {
    const offset = pixel * 4;
    if (data[offset + 3] < 32) continue;
    const r = data[offset] >> 3;
    const g = data[offset + 1] >> 3;
    const b = data[offset + 2] >> 3;
    const key = (r << 10) | (g << 5) | b;
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }
  const candidates = [...histogram]
    .map(([key, count]) => ({
      r: ((key >> 10) & 31) * 8 + 4,
      g: ((key >> 5) & 31) * 8 + 4,
      b: (key & 31) * 8 + 4,
      count
    }))
    .sort((a, b) => b.count - a.count);
  if (candidates.length === 0) throw new Error('No visible colors were found.');
  const palette = [candidates[0]];
  while (palette.length < colorCount && palette.length < candidates.length) {
    let best;
    for (const candidate of candidates) {
      const separation = Math.min(...palette.map((color) => colorDistance(candidate, color)));
      const score = separation * Math.log2(candidate.count + 1);
      if (!best || score > best.score) best = { ...candidate, score };
    }
    palette.push(best);
  }

  const samples = candidates.flatMap((candidate) => {
    const repeats = Math.min(20, Math.max(1, Math.round(Math.log2(candidate.count + 1))));
    return Array.from({ length: repeats }, () => candidate);
  });
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const sums = palette.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (const sample of samples) {
      let nearest = 0;
      let nearestDistance = Infinity;
      palette.forEach((color, index) => {
        const distance = colorDistance(sample, color);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      const sum = sums[nearest];
      sum.r += sample.r;
      sum.g += sample.g;
      sum.b += sample.b;
      sum.count += 1;
    }
    palette.forEach((color, index) => {
      const sum = sums[index];
      if (!sum.count) return;
      color.r = Math.round(sum.r / sum.count);
      color.g = Math.round(sum.g / sum.count);
      color.b = Math.round(sum.b / sum.count);
    });
  }
  return palette.map(({ r, g, b }) => ({ r, g, b }));
}

function rgbHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function mergeMinorPaletteLabels(labels, palette, counts) {
  const visiblePixels = counts.reduce((total, count) => total + count, 0);
  if (visiblePixels === 0) return;
  const redirects = new Int16Array(palette.length);
  redirects.fill(-1);
  const indexes = palette
    .map((_, index) => index)
    .filter((index) => counts[index] > 0)
    .sort((a, b) => counts[a] - counts[b]);
  for (const source of indexes) {
    const share = counts[source] / visiblePixels;
    let target = -1;
    let nearestDistance = Infinity;
    for (const candidate of indexes) {
      if (
        candidate === source ||
        redirects[candidate] !== -1 ||
        counts[candidate] <= counts[source]
      ) continue;
      const distance = colorDistance(palette[source], palette[candidate]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = candidate;
      }
    }
    const closeAntialiasShade = share <= 0.0075 && nearestDistance <= 35 ** 2;
    const tinyColorFragment = share <= 0.0005 && nearestDistance <= 80 ** 2;
    if (target !== -1 && (closeAntialiasShade || tinyColorFragment)) {
      redirects[source] = target;
    }
  }
  if (![...redirects].some((target) => target !== -1)) return;
  counts.fill(0);
  for (let pixel = 0; pixel < labels.length; pixel += 1) {
    let label = labels[pixel];
    if (label === 255) continue;
    while (redirects[label] !== -1) label = redirects[label];
    labels[pixel] = label;
    counts[label] += 1;
  }
}

function createOverlappingMask(
  labels,
  width,
  height,
  retainedIndexes,
  exactMask
) {
  const mask = exactMask.slice();
  for (let pixel = 0; pixel < labels.length; pixel += 1) {
    if (exactMask[pixel]) continue;
    if (!retainedIndexes.has(labels[pixel])) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    for (let offsetY = -1; offsetY <= 1 && !mask[pixel]; offsetY += 1) {
      const neighborY = y + offsetY;
      if (neighborY < 0 || neighborY >= height) continue;
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const neighborX = x + offsetX;
        if (neighborX < 0 || neighborX >= width) continue;
        if (exactMask[neighborY * width + neighborX]) {
          mask[pixel] = 1;
          break;
        }
      }
    }
  }
  return mask;
}

function removeBorderConnectedLabel(labels, width, height, layerIndex, queue) {
  const artworkLabels = labels.slice();
  let head = 0;
  let tail = 0;
  const enqueue = (pixel) => {
    if (artworkLabels[pixel] !== layerIndex) return;
    artworkLabels[pixel] = 255;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
  return artworkLabels;
}

function removeSmallMaskComponents(mask, width, height, minimumArea, queue) {
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    mask[start] = 2;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighborY = y + offsetY;
        if (neighborY < 0 || neighborY >= height) continue;
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborX = x + offsetX;
          if (neighborX < 0 || neighborX >= width) continue;
          const neighbor = neighborY * width + neighborX;
          if (mask[neighbor] !== 1) continue;
          mask[neighbor] = 2;
          queue[tail++] = neighbor;
        }
      }
    }
    const replacement = tail < minimumArea ? 0 : 2;
    for (let index = 0; index < tail; index += 1) {
      mask[queue[index]] = replacement;
    }
  }
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] === 2) mask[pixel] = 1;
  }
}

function svgNameId(name) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'layer';
}

async function multicolorPaths(
  data,
  width,
  height,
  colorCount,
  removeBackground,
  keepWhiteLayer,
  fillColorGaps,
  curveSmoothing,
  signal
) {
  throwIfAborted(signal);
  const palette = buildPalette(data, colorCount);
  const labels = new Uint8Array(width * height);
  const counts = new Uint32Array(palette.length);
  for (let pixel = 0; pixel < labels.length; pixel += 1) {
    const offset = pixel * 4;
    if (data[offset + 3] < 32) {
      labels[pixel] = 255;
      continue;
    }
    const sample = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
    let nearest = 0;
    let nearestDistance = Infinity;
    palette.forEach((color, index) => {
      const distance = colorDistance(sample, color);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    labels[pixel] = nearest;
    counts[nearest] += 1;
  }
  if (fillColorGaps) mergeMinorPaletteLabels(labels, palette, counts);
  const cornerIndexes = [0, width - 1, (height - 1) * width, width * height - 1];
  const backgroundLayer = cornerIndexes
    .map((index) => labels[index])
    .filter((index) => index !== 255)
    .sort((a, b) => counts[b] - counts[a])[0];
  const whiteCornerCount = cornerIndexes.filter((index) => {
    const offset = index * 4;
    return (
      data[offset + 3] >= 32 &&
      data[offset] >= 240 &&
      data[offset + 1] >= 240 &&
      data[offset + 2] >= 240
    );
  }).length;
  const whiteBackground = whiteCornerCount >= Math.ceil(cornerIndexes.length / 2);
  if (keepWhiteLayer && whiteBackground && backgroundLayer !== undefined) {
    palette[backgroundLayer] = { r: 255, g: 255, b: 255 };
  }
  const isWhite = (color) => color.r >= 240 && color.g >= 240 && color.b >= 240;
  const componentQueue = new Int32Array(labels.length);
  const artworkLabels = (
    removeBackground &&
    keepWhiteLayer &&
    whiteBackground &&
    backgroundLayer !== undefined
  )
    ? removeBorderConnectedLabel(
      labels,
      width,
      height,
      backgroundLayer,
      componentQueue
    )
    : labels;
  const layerOrder = palette
    .map((color, index) => ({ color, index, luminance: color.r + color.g + color.b }))
    .filter((layer) => counts[layer.index] > 0)
    .filter((layer) => (
      !removeBackground ||
      layer.index !== backgroundLayer ||
      (keepWhiteLayer && (whiteBackground || isWhite(layer.color)))
    ))
    .sort((a, b) => b.luminance - a.luminance);
  const retainedIndexes = new Set(layerOrder.map((layer) => layer.index));
  const minimumComponentArea = Math.max(
    3,
    Math.round(width * height / 20000)
  );
  const layers = [];
  for (const layer of layerOrder) {
    throwIfAborted(signal);
    const exactMask = new Int8Array(labels.length);
    for (let pixel = 0; pixel < labels.length; pixel += 1) {
      exactMask[pixel] = artworkLabels[pixel] === layer.index ? 1 : 0;
    }
    removeSmallMaskComponents(
      exactMask,
      width,
      height,
      minimumComponentArea,
      componentQueue
    );
    let mask = exactMask;
    if (fillColorGaps) {
      mask = createOverlappingMask(
        artworkLabels,
        width,
        height,
        retainedIndexes,
        exactMask
      );
    }
    const pathData = await traceMask(mask, width, height, curveSmoothing);
    throwIfAborted(signal);
    if (pathData) {
      layers.push({
        color: rgbHex(layer.color),
        pathData
      });
    }
  }
  return layers;
}

export async function vectorizeMonochrome(
  input,
  {
    targetHeightMm = 1000,
    threshold = 200,
    maximumTraceSide = 3000,
    allowTraceUpscaling = false,
    curveSmoothing = 50,
    mode = 'monochrome',
    svgStructure = 'groups',
    colorCount = 6,
    removeBackground = true,
    keepWhiteLayer = true,
    fillColorGaps = true,
    signal
  } = {}
) {
  throwIfAborted(signal);
  validateOptions({
    targetHeightMm,
    threshold,
    maximumTraceSide,
    curveSmoothing,
    mode,
    svgStructure,
    colorCount
  });
  const normalized = await sharp(input, { limitInputPixels: false })
    .rotate()
    .ensureAlpha()
    .png()
    .toBuffer();
  throwIfAborted(signal);
  const metadata = await sharp(normalized, { limitInputPixels: false }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine the source image dimensions.');
  }

  let tracePipeline = sharp(normalized, { limitInputPixels: false })
    .resize({
      width: maximumTraceSide,
      height: maximumTraceSide,
      fit: 'inside',
      withoutEnlargement: !allowTraceUpscaling
    });
  if (mode === 'monochrome') {
    tracePipeline = tracePipeline.flatten({ background: 'white' }).grayscale().threshold(threshold);
  } else {
    tracePipeline = tracePipeline.ensureAlpha();
  }
  const { data, info } = await tracePipeline.raw().toBuffer({ resolveWithObject: true });
  throwIfAborted(signal);
  let vectorLayers;
  if (mode === 'monochrome') {
    const mask = new Int8Array(info.width * info.height);
    for (let index = 0; index < data.length; index += 1) mask[index] = data[index] < 128 ? 1 : 0;
    const pathData = await traceMask(mask, info.width, info.height, curveSmoothing);
    throwIfAborted(signal);
    vectorLayers = pathData
      ? [{ color: '#000000', pathData }]
      : [];
  } else {
    vectorLayers = await multicolorPaths(
      data,
      info.width,
      info.height,
      colorCount,
      Boolean(removeBackground),
      Boolean(keepWhiteLayer),
      Boolean(fillColorGaps),
      curveSmoothing,
      signal
    );
  }
  if (vectorLayers.length === 0) throw new Error('No traceable artwork was found.');

  const targetWidthMm = targetHeightMm * metadata.width / metadata.height;
  const layerElements = vectorLayers.map((layer, index) => {
    const label = `Color ${index + 1} — ${layer.color.toUpperCase()}`;
    const layerNumber = index + 1;
    const pathId = svgNameId(label);
    const groupId = `${pathId}-group`;
    const path = `<path id="${pathId}" data-name="${label}" ` +
      `${svgStructure !== 'groups' ? `data-layer-root="${layerNumber}" ` : ''}` +
      `data-layer-index="${layerNumber}" d="${layer.pathData}" ` +
      `fill="${layer.color}" fill-rule="evenodd"><title>${label}</title></path>`;
    if (svgStructure !== 'groups') return path;
    const editorLayerAttributes =
      `inkscape:groupmode="layer" inkscape:label="${label}" `;
    return `<g id="${groupId}" data-name="${label}" data-layer-root="${layerNumber}" ` +
      `data-layer-index="${layerNumber}" ${editorLayerAttributes}` +
      `data-color="${layer.color}">` +
      `<title>${label}</title>${path}</g>`;
  });
  const svg =
    `<svg version="1.1" width="${targetWidthMm.toFixed(3)}mm" ` +
    `height="${targetHeightMm.toFixed(3)}mm" ` +
    `viewBox="0 0 ${info.width} ${info.height}" xmlns="http://www.w3.org/2000/svg" ` +
    `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">` +
    `${layerElements.join('')}</svg>`;
  return {
    svg: `${svg}\n`,
    source: { width: metadata.width, height: metadata.height },
    trace: { width: info.width, height: info.height },
    output: { widthMm: targetWidthMm, heightMm: targetHeightMm },
    mode,
    svgStructure,
    colors: vectorLayers.length,
    palette: vectorLayers.map((layer, index) => ({
      layer: index + 1,
      color: layer.color.toUpperCase(),
      name: `Color ${index + 1} — ${layer.color.toUpperCase()}`
    }))
  };
}
