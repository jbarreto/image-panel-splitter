const $ = (id) => document.getElementById(id);
const imageInput = $('imageInput');
const paperInput = $('paper');
const unitSystemInput = $('unitSystem');
const orientationInput = $('orientation');
const orientationButtons = [...document.querySelectorAll('.orientation-option')];
const panelWidth = $('panelWidth');
const panelHeight = $('panelHeight');
const panelWidthValue = $('panelWidthValue');
const panelHeightValue = $('panelHeightValue');
const panelWidthLabel = $('panelWidthLabel');
const panelHeightLabel = $('panelHeightLabel');
const dpiInput = $('dpi');
const targetHeightInput = $('targetHeight');
const gridWidthInput = $('gridWidth');
const gridColorInput = $('gridColor');
const autoGridButton = $('autoGridButton');
const printNumbersInput = $('printNumbers');
const numberSizePresetInput = $('numberSizePreset');
const exportButton = $('exportButton');
const exportProgressWrap = $('exportProgressWrap');
const exportProgress = $('exportProgress');
const exportProgressText = $('exportProgressText');
const exportProgressPercent = $('exportProgressPercent');
const exportProgressClose = $('exportProgressClose');
const exportProgressHint = $('exportProgressHint');
const imageDimensions = $('imageDimensions');
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const stats = $('stats');
const dropZone = $('dropZone');
let file;
let image;
let previewGrid;
let gridDrag;
let activeExport;
let canvasHovered = false;
let autoLayout;
let previewPanelRects = [];
let panelNumberAnchors = [];
let panelNumberLayoutKey = '';
let numberDrag;
let hoveredNumberIndex;
let panelNumberExportSizePx = 20;

function setAutoLayout(layout) {
  autoLayout = layout;
  autoGridButton.setAttribute('aria-pressed', String(Boolean(layout)));
  autoGridButton.querySelector('.toggle-state').textContent = layout ? 'On' : 'Off';
  updateOrientationAvailability();
}

function printNumbersEnabled() {
  return printNumbersInput.getAttribute('aria-pressed') === 'true';
}

function setPrintNumbers(enabled) {
  printNumbersInput.setAttribute('aria-pressed', String(enabled));
  printNumbersInput.querySelector('.toggle-state').textContent = enabled ? 'On' : 'Off';
  if (!enabled) hoveredNumberIndex = undefined;
}

function syncPanelNumberAnchors(panels) {
  const layoutKey = panels
    .map((panel) => [panel.left, panel.top, panel.width, panel.height].map(Math.round).join(','))
    .join(';');
  if (layoutKey !== panelNumberLayoutKey) {
    panelNumberLayoutKey = layoutKey;
    panelNumberAnchors = panels.map((panel) => ({
      x: panel.left + panel.width / 2,
      y: panel.top + panel.height / 2
    }));
  }
  previewPanelRects = panels;
}

const panelLimitText = $('panelLimit');
const DISPLAY_SETTINGS_KEY = 'ronyka-panel-splitter.display-settings.v1';
const PANEL_NUMBER_SIZE_PRESETS_PX = {
  small: 14,
  medium: 20,
  large: 28
};

function selectedPanelNumberSizePx() {
  return PANEL_NUMBER_SIZE_PRESETS_PX[numberSizePresetInput.value] || PANEL_NUMBER_SIZE_PRESETS_PX.medium;
}

function panelsInReadingOrder(panels) {
  if (panels.length < 2) return panels;
  const heights = panels.map((panel) => panel.pageHeight || panel.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)];
  const rowTolerance = Math.max(1, medianHeight * 0.25);
  const rows = [];
  for (const panel of [...panels].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const currentRow = rows.at(-1);
    if (!currentRow || panel.top - currentRow.top > rowTolerance) {
      rows.push({ top: panel.top, panels: [panel] });
    } else {
      currentRow.panels.push(panel);
    }
  }
  return rows.flatMap((row) =>
    row.panels.sort((a, b) => a.left - b.left || a.top - b.top)
  );
}

const PANEL_LIMITS_IN = {
  letter: { landscape: { width: 9.26, height: 6.55 }, portrait: { width: 6.55, height: 9.26 } },
  legal: { landscape: { width: 11.84, height: 6.76 }, portrait: { width: 6.76, height: 11.84 } },
  custom: { landscape: { width: 100, height: 100 }, portrait: { width: 100, height: 100 } }
};

function saveDisplaySettings() {
  try {
    localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify({
      paper: paperInput.value,
      unitSystem: unitSystemInput.value,
      printNumbers: printNumbersEnabled(),
      numberSizePreset: numberSizePresetInput.value
    }));
  } catch {
    // Keep the GUI functional when browser storage is unavailable.
  }
}

function restoreDisplaySettings() {
  let settings;
  try {
    settings = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY) || 'null');
  } catch {
    return;
  }
  if (!settings || typeof settings !== 'object') return;
  if (PANEL_LIMITS_IN[settings.paper]) paperInput.value = settings.paper;
  if (['metric', 'imperial'].includes(settings.unitSystem)) {
    unitSystemInput.value = settings.unitSystem;
  }
  if (typeof settings.printNumbers === 'boolean') {
    setPrintNumbers(settings.printNumbers);
  }
  if (settings.numberSizePreset in PANEL_NUMBER_SIZE_PRESETS_PX) {
    numberSizePresetInput.value = settings.numberSizePreset;
  }
}

function panelLimits() {
  const limits = PANEL_LIMITS_IN[paperInput.value][orientationInput.value];
  return { maxWidth: limits.width, maxHeight: limits.height };
}

function usesMetricUnits() {
  return unitSystemInput.value === 'metric';
}

function inchesToDisplay(inches) {
  return usesMetricUnits() ? inches * 2.54 : inches;
}

function clampPanelDimensions() {
  const { maxWidth, maxHeight } = panelLimits();
  panelWidth.max = String(maxWidth);
  panelHeight.max = String(maxHeight);
  const unit = usesMetricUnits() ? 'cm' : 'in';
  const displayedWidth = inchesToDisplay(maxWidth);
  const displayedHeight = inchesToDisplay(maxHeight);
  panelLimitText.textContent = paperInput.value === 'custom'
    ? `Custom panel size (maximum ${displayedWidth.toFixed(2)} × ${displayedHeight.toFixed(2)} ${unit})`
    : `Maximum panel: ${displayedWidth.toFixed(2)} × ${displayedHeight.toFixed(2)} ${unit}`;
  const width = Math.min(maxWidth, Math.max(Number(panelWidth.min), Number(panelWidth.value)));
  const height = Math.min(maxHeight, Math.max(Number(panelHeight.min), Number(panelHeight.value)));
  panelWidth.value = width.toFixed(2);
  panelHeight.value = height.toFixed(2);
}

function applyOrientationLimits({ resetToMaximum = false } = {}) {
  const { maxWidth, maxHeight } = panelLimits();
  panelWidth.max = String(maxWidth);
  panelHeight.max = String(maxHeight);
  if (resetToMaximum) {
    panelWidth.value = maxWidth.toFixed(2);
    panelHeight.value = maxHeight.toFixed(2);
  }
  clampPanelDimensions();
}

function values() {
  clampPanelDimensions();
  return {
    paper: paperInput.value,
    orientation: orientationInput.value,
    panelWidthIn: Number(panelWidth.value),
    panelHeightIn: Number(panelHeight.value),
    dpi: Number(dpiInput.value),
    targetHeightMm: Number(targetHeightInput.value),
    gridWidthMm: Number(gridWidthInput.value),
    printNumbers: printNumbersEnabled()
  };
}

function updateLabels() {
  clampPanelDimensions();
  const metric = usesMetricUnits();
  const unit = metric ? 'cm' : 'in';
  panelWidthLabel.textContent = `Panel width (${unit})`;
  panelHeightLabel.textContent = `Panel height (${unit})`;
  panelWidthValue.value = `${inchesToDisplay(Number(panelWidth.value)).toFixed(2)} ${unit}`;
  panelHeightValue.value = `${inchesToDisplay(Number(panelHeight.value)).toFixed(2)} ${unit}`;
}

function render() {
  updateLabels();
  if (!image) {
    previewGrid = undefined;
    return;
  }
  const v = values();
  const targetHeightPx = v.targetHeightMm > 0
    ? Math.round((v.targetHeightMm / 25.4) * v.dpi)
    : image.naturalHeight;
  const scaleToOutput = targetHeightPx / image.naturalHeight;
  const outputWidthPx = image.naturalWidth * scaleToOutput;
  const outputHeightPx = image.naturalHeight * scaleToOutput;
  const panelWidthPx = v.panelWidthIn * v.dpi;
  const panelHeightPx = v.panelHeightIn * v.dpi;
  const columns = Math.max(1, Math.ceil(outputWidthPx / panelWidthPx));
  const rows = Math.max(1, Math.ceil(outputHeightPx / panelHeightPx));

  const maxWidth = Math.max(320, window.innerWidth - 440);
  const maxHeight = Math.max(320, window.innerHeight - 48);
  const previewScale = Math.min(maxWidth / outputWidthPx, maxHeight / outputHeightPx, 1);
  canvas.width = Math.max(1, Math.round(outputWidthPx * previewScale));
  canvas.height = Math.max(1, Math.round(outputHeightPx * previewScale));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.strokeStyle = gridColorInput.value;
  const gridLineWidthCanvas = Math.max(1, v.gridWidthMm / 25.4 * v.dpi * previewScale);
  ctx.lineWidth = gridLineWidthCanvas;
  let previewPanels;
  if (autoLayout) {
    previewPanels = autoLayout.panels;
    for (const panel of previewPanels) {
      ctx.strokeRect(
        panel.left * previewScale,
        panel.top * previewScale,
        panel.width * previewScale,
        panel.height * previewScale
      );
    }
  } else {
    previewPanels = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const left = column * panelWidthPx;
        const top = row * panelHeightPx;
        previewPanels.push({
          left,
          top,
          width: Math.min(panelWidthPx, outputWidthPx - left),
          height: Math.min(panelHeightPx, outputHeightPx - top)
        });
      }
    }
    for (let column = 0; column <= columns; column += 1) {
      const x = Math.min(canvas.width, column * panelWidthPx * previewScale);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = Math.min(canvas.height, row * panelHeightPx * previewScale);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }
  ctx.restore();
  syncPanelNumberAnchors(previewPanels);

  if (v.printNumbers) {
    const selectedNumberSizePx = selectedPanelNumberSizePx();
    const displayedCanvasWidth = Math.max(1, canvas.getBoundingClientRect().width);
    const backingToDisplayScale = canvas.width / displayedCanvasWidth;
    const outputToDisplayScale = displayedCanvasWidth / outputWidthPx;
    panelNumberExportSizePx = Math.max(
      selectedNumberSizePx,
      Math.round(selectedNumberSizePx / outputToDisplayScale)
    );
    panelNumberAnchors = panelNumberAnchors.map((anchor, index) =>
      clampNumberAnchor(previewPanels[index], anchor, panelNumberExportSizePx / 2)
    );
    const fontSize = selectedNumberSizePx * backingToDisplayScale;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, Math.round(selectedNumberSizePx * 0.18)) * backingToDisplayScale;
    ctx.strokeStyle = 'white';
    ctx.fillStyle = gridColorInput.value;
    previewPanels.forEach((panel, index) => {
      const emphasized = hoveredNumberIndex === index || numberDrag?.index === index;
      ctx.font = `${emphasized ? 900 : 500} ${fontSize}px Arial, Helvetica, sans-serif`;
      ctx.globalAlpha = emphasized ? 1 : 0.5;
      const x = panelNumberAnchors[index].x * previewScale;
      const y = panelNumberAnchors[index].y * previewScale;
      ctx.strokeText(String(index), x, y);
      ctx.fillText(String(index), x, y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  previewGrid = {
    outputWidthPx,
    outputHeightPx,
    panelWidthPx,
    panelHeightPx,
    columns,
    rows,
    gridLineWidthCanvas
  };

  const widthIn = outputWidthPx / v.dpi;
  const heightIn = outputHeightPx / v.dpi;
  const unit = usesMetricUnits() ? 'cm' : 'in';
  const displayedWidth = inchesToDisplay(widthIn);
  const displayedHeight = inchesToDisplay(heightIn);
  stats.textContent = autoLayout
    ? `Auto layout = ${autoLayout.panels.length} mixed-orientation panels\nPoster ${displayedWidth.toFixed(2)} × ${displayedHeight.toFixed(2)} ${unit} (W × H)`
    : `${columns} columns × ${rows} rows = ${columns * rows} panels\nPoster ${displayedWidth.toFixed(2)} × ${displayedHeight.toFixed(2)} ${unit} (W × H)`;
}

async function loadFile(selected) {
  if (!selected) return;
  resetExportProgress();
  setAutoLayout(undefined);
  hoveredNumberIndex = undefined;
  file = selected;
  const url = URL.createObjectURL(file);
  image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    exportButton.disabled = false;
    autoGridButton.disabled = false;
    imageDimensions.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight} px`;
    render();
  };
  image.src = url;
}

imageInput.addEventListener('change', () => loadFile(imageInput.files[0]));

function artworkMask() {
  const maximumSide = 192;
  const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  maskContext.drawImage(image, 0, 0, width, height);
  const pixels = maskContext.getImageData(0, 0, width, height).data;
  const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
  const background = cornerIndexes.reduce(
    (sum, index) => ({
      r: sum.r + pixels[index * 4],
      g: sum.g + pixels[index * 4 + 1],
      b: sum.b + pixels[index * 4 + 2],
      a: sum.a + pixels[index * 4 + 3]
    }),
    { r: 0, g: 0, b: 0, a: 0 }
  );
  for (const key of Object.keys(background)) background[key] /= cornerIndexes.length;
  const transparentBackground = background.a < 128;
  const occupied = new Uint8Array(width * height);
  for (let index = 0; index < occupied.length; index += 1) {
    const alpha = pixels[index * 4 + 3];
    const colorDistance = Math.max(
      Math.abs(pixels[index * 4] - background.r),
      Math.abs(pixels[index * 4 + 1] - background.g),
      Math.abs(pixels[index * 4 + 2] - background.b)
    );
    occupied[index] = alpha > 16 && (transparentBackground || colorDistance > 20) ? 1 : 0;
  }
  return { width, height, occupied };
}

function buildAutoLayout() {
  const v = values();
  const targetHeight = v.targetHeightMm > 0
    ? Math.round((v.targetHeightMm / 25.4) * v.dpi)
    : image.naturalHeight;
  const outputWidth = Math.round(image.naturalWidth * targetHeight / image.naturalHeight);
  const outputHeight = targetHeight;
  const mask = artworkMask();
  const baseWidth = v.panelWidthIn * v.dpi;
  const baseHeight = v.panelHeightIn * v.dpi;
  const orientations = [
    { width: baseWidth, height: baseHeight },
    { width: baseHeight, height: baseWidth }
  ].filter((candidate, index, all) =>
    index === 0 || candidate.width !== all[0].width || candidate.height !== all[0].height
  ).map((orientation) => ({
    ...orientation,
    widthCells: Math.max(1, Math.floor(orientation.width * mask.width / outputWidth)),
    heightCells: Math.max(1, Math.floor(orientation.height * mask.height / outputHeight))
  }));

  function trim(bounds) {
    let { left, top, right, bottom } = bounds;
    const columnHasArtwork = (x) => {
      for (let y = top; y < bottom; y += 1) {
        if (mask.occupied[y * mask.width + x]) return true;
      }
      return false;
    };
    const rowHasArtwork = (y) => {
      for (let x = left; x < right; x += 1) {
        if (mask.occupied[y * mask.width + x]) return true;
      }
      return false;
    };
    while (left < right && !columnHasArtwork(left)) left += 1;
    while (left < right && !columnHasArtwork(right - 1)) right -= 1;
    while (top < bottom && !rowHasArtwork(top)) top += 1;
    while (top < bottom && !rowHasArtwork(bottom - 1)) bottom -= 1;
    return left < right && top < bottom ? { left, top, right, bottom } : undefined;
  }

  function bestOrientation(bounds) {
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    return orientations
      .filter((orientation) => width <= orientation.widthCells && height <= orientation.heightCells)
      .sort((a, b) =>
        a.widthCells * a.heightCells - b.widthCells * b.heightCells
      )[0];
  }

  function estimatedPanels(bounds) {
    if (!bounds) return 0;
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    return Math.min(...orientations.map((orientation) =>
      Math.ceil(width / orientation.widthCells) * Math.ceil(height / orientation.heightCells)
    ));
  }

  function cutInk(axis, position, bounds) {
    let count = 0;
    if (axis === 'vertical') {
      for (let y = bounds.top; y < bounds.bottom; y += 1) {
        count += mask.occupied[y * mask.width + position - 1];
        count += mask.occupied[y * mask.width + position];
      }
    } else {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        count += mask.occupied[(position - 1) * mask.width + x];
        count += mask.occupied[position * mask.width + x];
      }
    }
    return count;
  }

  function splitBounds(bounds) {
    const candidates = [];
    for (let x = bounds.left + 1; x < bounds.right; x += 1) {
      const first = trim({ ...bounds, right: x });
      const second = trim({ ...bounds, left: x });
      if (!first || !second) continue;
      candidates.push({
        first,
        second,
        estimate: estimatedPanels(first) + estimatedPanels(second),
        ink: cutInk('vertical', x, bounds),
        imbalance: Math.abs((first.right - first.left) - (second.right - second.left))
      });
    }
    for (let y = bounds.top + 1; y < bounds.bottom; y += 1) {
      const first = trim({ ...bounds, bottom: y });
      const second = trim({ ...bounds, top: y });
      if (!first || !second) continue;
      candidates.push({
        first,
        second,
        estimate: estimatedPanels(first) + estimatedPanels(second),
        ink: cutInk('horizontal', y, bounds),
        imbalance: Math.abs((first.bottom - first.top) - (second.bottom - second.top))
      });
    }
    candidates.sort((a, b) =>
      a.estimate - b.estimate || a.ink - b.ink || a.imbalance - b.imbalance
    );
    return candidates[0];
  }

  const leaves = [];
  function partition(rawBounds) {
    const bounds = trim(rawBounds);
    if (!bounds) return;
    const orientation = bestOrientation(bounds);
    if (orientation) {
      leaves.push({ bounds, orientation });
      return;
    }
    const split = splitBounds(bounds);
    if (!split) throw new Error('Could not partition the visible artwork into non-overlapping panels.');
    partition(split.first);
    partition(split.second);
  }
  partition({ left: 0, top: 0, right: mask.width, bottom: mask.height });

  const panels = leaves.map(({ bounds, orientation }) => {
    const left = Math.floor(bounds.left * outputWidth / mask.width);
    const top = Math.floor(bounds.top * outputHeight / mask.height);
    const right = Math.floor(bounds.right * outputWidth / mask.width);
    const bottom = Math.floor(bounds.bottom * outputHeight / mask.height);
    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      pageWidth: Math.round(orientation.width),
      pageHeight: Math.round(orientation.height),
      orientation: orientation.width >= orientation.height ? 'landscape' : 'portrait'
    };
  });
  const orderedPanels = panelsInReadingOrder(panels);
  return { outputWidth, outputHeight: targetHeight, panels: orderedPanels };
}

autoGridButton.addEventListener('click', () => {
  if (!image) return;
  if (autoLayout) {
    setAutoLayout(undefined);
    render();
    return;
  }
  const generated = buildAutoLayout();
  if (generated.panels.length === 0) {
    window.alert('No visible artwork was detected. Use an image with transparency or a plain background.');
    return;
  }
  setAutoLayout(generated);
  render();
});

document.addEventListener('keydown', (event) => {
  const editingControl = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (
    event.repeat ||
    editingControl ||
    !exportProgressWrap.hidden ||
    autoGridButton.disabled ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !event.shiftKey ||
    event.key.toLowerCase() !== 'a'
  ) {
    return;
  }
  event.preventDefault();
  autoGridButton.click();
});

function selectOrientation(orientation, { dispatchChange = true } = {}) {
  orientationInput.value = orientation;
  for (const option of orientationButtons) {
    const selected = option.dataset.orientation === orientation;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-pressed', String(selected));
  }
  if (dispatchChange) orientationInput.dispatchEvent(new Event('change'));
}

function updateOrientationAvailability() {
  const disabled = paperInput.value === 'custom' || Boolean(autoLayout);
  for (const option of orientationButtons) option.disabled = disabled;
}

function recalculateAutoLayout() {
  if (!autoLayout || !image) return;
  setAutoLayout(buildAutoLayout());
}

for (const button of orientationButtons) {
  button.addEventListener('click', () => {
    selectOrientation(button.dataset.orientation);
  });
}
for (const input of [paperInput, orientationInput]) {
  input.addEventListener('change', () => {
    updateOrientationAvailability();
    applyOrientationLimits({ resetToMaximum: paperInput.value !== 'custom' });
    recalculateAutoLayout();
    render();
    if (input === paperInput) saveDisplaySettings();
  });
}
unitSystemInput.addEventListener('change', () => {
  render();
  saveDisplaySettings();
});
for (const input of [panelWidth, panelHeight, dpiInput, targetHeightInput, gridWidthInput, gridColorInput]) {
  input.addEventListener('input', () => {
    if ([panelWidth, panelHeight, dpiInput, targetHeightInput].includes(input)) {
      recalculateAutoLayout();
    }
    render();
  });
}
printNumbersInput.addEventListener('click', () => {
  setPrintNumbers(!printNumbersEnabled());
  saveDisplaySettings();
  render();
});
numberSizePresetInput.addEventListener('change', () => {
  saveDisplaySettings();
  render();
});
window.addEventListener('resize', render);

canvas.addEventListener('pointerenter', () => {
  canvasHovered = true;
});

canvas.addEventListener('pointerleave', () => {
  canvasHovered = false;
});

window.addEventListener('keydown', (event) => {
  if (!canvasHovered || !image || autoLayout || !exportProgressWrap.hidden) return;
  const adjustments = {
    ArrowLeft: { input: panelWidth, direction: -1 },
    ArrowRight: { input: panelWidth, direction: 1 },
    ArrowDown: { input: panelHeight, direction: 1 },
    ArrowUp: { input: panelHeight, direction: -1 }
  };
  const adjustment = adjustments[event.key];
  if (!adjustment) return;

  const step = Number(adjustment.input.step) || 0.01;
  const minimum = Number(adjustment.input.min);
  const maximum = Number(adjustment.input.max);
  const nextValue = Number(adjustment.input.value) + adjustment.direction * step;
  adjustment.input.value = Math.min(maximum, Math.max(minimum, nextValue)).toFixed(2);
  render();
  event.preventDefault();
});

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

function numberAt(event) {
  if (!printNumbersEnabled() || !previewGrid) return undefined;
  const point = canvasPoint(event);
  const hitRadius = 16 * canvas.width / canvas.getBoundingClientRect().width;
  let match;
  panelNumberAnchors.forEach((anchor, index) => {
    const x = anchor.x * canvas.width / previewGrid.outputWidthPx;
    const y = anchor.y * canvas.height / previewGrid.outputHeightPx;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= hitRadius && (!match || distance < match.distance)) {
      match = { index, distance };
    }
  });
  return match;
}

function clampNumberAnchor(panel, anchor, halfText) {
  const minimumX = Math.min(panel.left + halfText, panel.left + panel.width / 2);
  const maximumX = Math.max(panel.left + panel.width - halfText, panel.left + panel.width / 2);
  const minimumY = Math.min(panel.top + halfText, panel.top + panel.height / 2);
  const maximumY = Math.max(panel.top + panel.height - halfText, panel.top + panel.height / 2);
  return {
    x: Math.min(maximumX, Math.max(minimumX, anchor.x)),
    y: Math.min(maximumY, Math.max(minimumY, anchor.y))
  };
}

function moveDraggedNumber(event) {
  if (!numberDrag || !previewGrid) return false;
  const point = canvasPoint(event);
  const panel = previewPanelRects[numberDrag.index];
  const halfText = panelNumberExportSizePx / 2;
  panelNumberAnchors[numberDrag.index] = clampNumberAnchor(panel, {
    x: point.x * previewGrid.outputWidthPx / canvas.width,
    y: point.y * previewGrid.outputHeightPx / canvas.height
  }, halfText);
  render();
  canvas.style.cursor = 'grabbing';
  event.preventDefault();
  return true;
}

function gridLineAt(event) {
  if (!previewGrid || autoLayout) return undefined;
  const point = canvasPoint(event);
  const xScale = canvas.width / previewGrid.outputWidthPx;
  const yScale = canvas.height / previewGrid.outputHeightPx;
  const canvasToCssScale = canvas.width / canvas.getBoundingClientRect().width;
  const hitDistance = Math.max(
    9 * canvasToCssScale,
    previewGrid.gridLineWidthCanvas / 2 + 3 * canvasToCssScale
  );
  let vertical;
  let horizontal;

  for (let index = 1; index < previewGrid.columns; index += 1) {
    const position = index * previewGrid.panelWidthPx * xScale;
    const distance = Math.abs(point.x - position);
    if (distance <= hitDistance && (!vertical || distance < vertical.distance)) {
      vertical = { index, distance };
    }
  }
  for (let index = 1; index < previewGrid.rows; index += 1) {
    const position = index * previewGrid.panelHeightPx * yScale;
    const distance = Math.abs(point.y - position);
    if (distance <= hitDistance && (!horizontal || distance < horizontal.distance)) {
      horizontal = { index, distance };
    }
  }
  if (vertical && horizontal) {
    return {
      axis: 'both',
      widthIndex: vertical.index,
      heightIndex: horizontal.index
    };
  }
  if (vertical) return { axis: 'width', widthIndex: vertical.index };
  if (horizontal) return { axis: 'height', heightIndex: horizontal.index };
  const touchesOuterBoundary =
    point.x <= hitDistance ||
    point.y <= hitDistance ||
    point.x >= canvas.width - hitDistance ||
    point.y >= canvas.height - hitDistance;
  return touchesOuterBoundary ? undefined : { axis: 'both', fromPanelInterior: true };
}

function gridCursor(line, dragging = false) {
  if (line?.axis === 'both') return dragging ? 'grabbing' : 'grab';
  if (line?.axis === 'width') return 'col-resize';
  if (line?.axis === 'height') return 'row-resize';
  return '';
}

canvas.addEventListener('pointerdown', (event) => {
  const number = numberAt(event);
  if (number) {
    numberDrag = { index: number.index };
    hoveredNumberIndex = number.index;
    render();
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  const line = gridLineAt(event);
  if (!line) return;
  setAutoLayout(undefined);
  gridDrag = {
    ...line,
    startPoint: canvasPoint(event),
    startWidthIn: Number(panelWidth.value),
    startHeightIn: Number(panelHeight.value)
  };
  canvas.style.cursor = gridCursor(gridDrag, true);
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging-grid');
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (moveDraggedNumber(event)) return;
  if (!gridDrag) {
    const number = numberAt(event);
    const nextHoveredIndex = number?.index;
    if (nextHoveredIndex !== hoveredNumberIndex) {
      hoveredNumberIndex = nextHoveredIndex;
      render();
    }
    canvas.style.cursor = number ? 'grab' : gridCursor(gridLineAt(event));
    return;
  }

  const point = canvasPoint(event);
  const v = values();
  const { maxWidth, maxHeight } = panelLimits();
  if (gridDrag.fromPanelInterior) {
    const deltaX = (point.x - gridDrag.startPoint.x) * previewGrid.outputWidthPx / canvas.width;
    const deltaY = (point.y - gridDrag.startPoint.y) * previewGrid.outputHeightPx / canvas.height;
    panelWidth.value = Math.min(
      maxWidth,
      Math.max(Number(panelWidth.min), gridDrag.startWidthIn + deltaX / v.dpi)
    ).toFixed(2);
    panelHeight.value = Math.min(
      maxHeight,
      Math.max(Number(panelHeight.min), gridDrag.startHeightIn + deltaY / v.dpi)
    ).toFixed(2);
    render();
    canvas.style.cursor = gridCursor(gridDrag, true);
    event.preventDefault();
    return;
  }
  if (gridDrag.axis === 'width' || gridDrag.axis === 'both') {
    const outputX = point.x * previewGrid.outputWidthPx / canvas.width;
    const widthIn = outputX / gridDrag.widthIndex / v.dpi;
    panelWidth.value = Math.min(maxWidth, Math.max(Number(panelWidth.min), widthIn)).toFixed(2);
  }
  if (gridDrag.axis === 'height' || gridDrag.axis === 'both') {
    const outputY = point.y * previewGrid.outputHeightPx / canvas.height;
    const heightIn = outputY / gridDrag.heightIndex / v.dpi;
    panelHeight.value = Math.min(maxHeight, Math.max(Number(panelHeight.min), heightIn)).toFixed(2);
  }
  render();
  canvas.style.cursor = gridCursor(gridDrag, true);
  event.preventDefault();
});

function finishGridDrag(event) {
  if (numberDrag) {
    numberDrag = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const number = numberAt(event);
    hoveredNumberIndex = number?.index;
    render();
    canvas.style.cursor = number ? 'grab' : '';
    return;
  }
  if (!gridDrag) return;
  gridDrag = undefined;
  canvas.classList.remove('dragging-grid');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  canvas.style.cursor = gridCursor(gridLineAt(event));
}

canvas.addEventListener('pointerup', finishGridDrag);
canvas.addEventListener('pointercancel', finishGridDrag);
canvas.addEventListener('pointerleave', (event) => {
  if (hoveredNumberIndex !== undefined && !numberDrag) {
    hoveredNumberIndex = undefined;
    render();
  }
  if (!gridDrag && !numberDrag) canvas.style.cursor = '';
  else if (numberDrag && event.buttons === 0) finishGridDrag(event);
  else if (event.buttons === 0) finishGridDrag(event);
});

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); });
}
dropZone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));

function showExportProgress(value, text) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  exportProgressWrap.hidden = false;
  exportProgress.value = percent;
  exportProgress.textContent = `${percent}%`;
  exportProgressPercent.textContent = `${percent}%`;
  exportProgressText.textContent = text;
  exportProgressHint.textContent = 'Press Esc to cancel generation.';
  exportProgressClose.hidden = true;
}

function resetExportProgress() {
  exportProgressWrap.hidden = true;
  exportProgress.value = 0;
  exportProgress.textContent = '0%';
  exportProgressPercent.textContent = '0%';
  exportProgressText.textContent = 'Preparing export…';
  exportProgressHint.textContent = 'Press Esc to cancel generation.';
  exportProgressClose.hidden = true;
}

function finishExportProgress(success, text = success ? 'Export complete.' : 'Export failed.') {
  showExportProgress(success ? 100 : 0, text);
  exportProgressHint.textContent = 'Press Esc to close';
  exportProgressClose.hidden = false;
  exportProgressClose.focus();
}

exportProgressClose.addEventListener('click', resetExportProgress);

async function cancelActiveExport() {
  if (!activeExport || activeExport.canceling) return;
  activeExport.canceling = true;
  showExportProgress(exportProgress.value, 'Canceling export…');
  activeExport.progressController.abort();
  activeExport.requestController.abort();
  try {
    await fetch(`/api/export/${encodeURIComponent(activeExport.id)}`, { method: 'DELETE' });
  } catch {
    // Aborting the original request also closes the server response, which
    // independently terminates an active generator.
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || exportProgressWrap.hidden) return;
  event.preventDefault();
  if (activeExport && !activeExport.canceling) {
    cancelActiveExport();
  } else {
    if (activeExport) activeExport.dismissOnFinish = true;
    resetExportProgress();
  }
});

async function pollExportProgress(exportId, signal) {
  while (!signal.aborted) {
    try {
      const response = await fetch(`/api/export-progress/${encodeURIComponent(exportId)}`, { signal });
      if (response.ok) {
        const progress = await response.json();
        if (progress.phase === 'generating') {
          const ratio = progress.total > 0 ? progress.completed / progress.total : 0;
          showExportProgress(
            20 + ratio * 70,
            progress.total > 0
              ? `Generating panel ${Math.min(progress.completed, progress.total)} of ${progress.total}…`
              : 'Calculating panels…'
          );
        } else if (progress.phase === 'preparing') {
          showExportProgress(3, 'Preparing export…');
        } else if (progress.phase === 'decoding') {
          showExportProgress(5, 'Decoding source image…');
        } else if (progress.phase === 'scaling') {
          showExportProgress(7, 'Scaling full poster…');
        } else if (progress.phase === 'calculating') {
          showExportProgress(8, 'Preparing panel layout…');
        } else if (progress.phase === 'layout') {
          showExportProgress(
            10,
            progress.total > 0
              ? `Layout calculated: ${progress.total} panels…`
              : 'Calculating panel layout…'
          );
        } else if (progress.phase === 'grid-preview') {
          showExportProgress(
            12,
            progress.total > 0
              ? `Creating full grid preview for ${progress.total} panels…`
              : 'Creating full grid preview…'
          );
        } else if (progress.phase === 'panels-ready') {
          showExportProgress(18, 'Full grid preview complete…');
        } else if (progress.phase === 'zipping') {
          showExportProgress(92, 'Creating ZIP…');
        } else if (progress.phase === 'complete') {
          showExportProgress(96, 'Downloading ZIP…');
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

exportButton.addEventListener('click', async () => {
  if (!file) return;
  exportButton.disabled = true;
  showExportProgress(2, 'Uploading image…');
  const exportId = crypto.randomUUID();
  const progressController = new AbortController();
  const requestController = new AbortController();
  activeExport = {
    id: exportId,
    progressController,
    requestController,
    canceling: false,
    dismissOnFinish: false
  };
  const progressPolling = pollExportProgress(exportId, progressController.signal);
  try {
    const v = values();
    const form = new FormData();
    form.append('image', file);
    form.append('paper', v.paper);
    form.append('orientation', v.orientation);
    form.append('panelWidthIn', v.panelWidthIn);
    form.append('panelHeightIn', v.panelHeightIn);
    form.append('dpi', v.dpi);
    form.append('targetHeightMm', v.targetHeightMm);
    form.append('gridLineWidthMm', v.gridWidthMm);
    form.append('gridColor', gridColorInput.value);
    form.append('gridMode', 'overlay');
    form.append('marginMm', '0');
    form.append('exportId', exportId);
    form.append('printNumbers', String(v.printNumbers));
    if (v.printNumbers) {
      form.append('numberPosition', 'center');
      form.append('numberSizePx', String(panelNumberExportSizePx));
      form.append('numberStyle', 'plain');
      form.append('numberColor', gridColorInput.value);
      form.append('numberAnchors', JSON.stringify(panelNumberAnchors));
    }
    if (autoLayout) form.append('panelLayout', JSON.stringify(autoLayout));
    const response = await fetch('/api/export', {
      method: 'POST',
      body: form,
      signal: requestController.signal
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Export failed.');
    }
    showExportProgress(96, 'Downloading ZIP…');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'poster-panels.zip';
    link.click();
    URL.revokeObjectURL(url);
    finishExportProgress(true);
  } catch (error) {
    const canceled = activeExport?.id === exportId && activeExport.canceling;
    const dismissed = activeExport?.id === exportId && activeExport.dismissOnFinish;
    if (!dismissed) finishExportProgress(false, canceled ? 'Export canceled.' : error.message);
  } finally {
    progressController.abort();
    await progressPolling;
    if (activeExport?.id === exportId) activeExport = undefined;
    exportButton.disabled = false;
  }
});

restoreDisplaySettings();
selectOrientation('landscape', { dispatchChange: false });
updateOrientationAvailability();
applyOrientationLimits({ resetToMaximum: paperInput.value !== 'custom' });
updateLabels();
