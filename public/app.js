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
const printNumbersInput = $('printNumbers');
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

const panelLimitText = $('panelLimit');

const PANEL_LIMITS_IN = {
  letter: { landscape: { width: 9.26, height: 6.55 }, portrait: { width: 6.55, height: 9.26 } },
  legal: { landscape: { width: 11.84, height: 6.76 }, portrait: { width: 6.76, height: 11.84 } }
};

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
  panelLimitText.textContent = `Maximum panel: ${displayedWidth.toFixed(2)} × ${displayedHeight.toFixed(2)} ${unit}`;
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
    gridWidthMm: Number(gridWidthInput.value)
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
  const targetHeightPx = v.targetHeightMm > 0 ? (v.targetHeightMm / 25.4) * v.dpi : image.naturalHeight;
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
  for (let column = 0; column <= columns; column += 1) {
    const x = Math.min(canvas.width, column * panelWidthPx * previewScale);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = Math.min(canvas.height, row * panelHeightPx * previewScale);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.restore();

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
  stats.textContent = `${columns} columns × ${rows} rows = ${columns * rows} panels\nPoster ${displayedWidth.toFixed(2)} × ${displayedHeight.toFixed(2)} ${unit} (W × H)`;
}

async function loadFile(selected) {
  if (!selected) return;
  resetExportProgress();
  file = selected;
  const url = URL.createObjectURL(file);
  image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    exportButton.disabled = false;
    imageDimensions.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight} px`;
    render();
  };
  image.src = url;
}

imageInput.addEventListener('change', () => loadFile(imageInput.files[0]));

function selectOrientation(orientation, { dispatchChange = true } = {}) {
  orientationInput.value = orientation;
  for (const option of orientationButtons) {
    const selected = option.dataset.orientation === orientation;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-pressed', String(selected));
  }
  if (dispatchChange) orientationInput.dispatchEvent(new Event('change'));
}

for (const button of orientationButtons) {
  button.addEventListener('click', () => {
    selectOrientation(button.dataset.orientation);
  });
}
for (const input of [paperInput, orientationInput]) {
  input.addEventListener('change', () => {
    applyOrientationLimits({ resetToMaximum: true });
    render();
  });
}
unitSystemInput.addEventListener('change', () => {
  render();
});
for (const input of [panelWidth, panelHeight, dpiInput, targetHeightInput, gridWidthInput, gridColorInput]) {
  input.addEventListener('input', render);
}
window.addEventListener('resize', render);

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

function gridLineAt(event) {
  if (!previewGrid) return undefined;
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
  const line = gridLineAt(event);
  if (!line) return;
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
  if (!gridDrag) {
    const line = gridLineAt(event);
    canvas.style.cursor = gridCursor(line);
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
  if (!gridDrag) return;
  gridDrag = undefined;
  canvas.classList.remove('dragging-grid');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  canvas.style.cursor = gridCursor(gridLineAt(event));
}

canvas.addEventListener('pointerup', finishGridDrag);
canvas.addEventListener('pointercancel', finishGridDrag);
canvas.addEventListener('pointerleave', (event) => {
  if (!gridDrag) canvas.style.cursor = '';
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
            10 + ratio * 80,
            progress.total > 0
              ? `Generating panel ${Math.min(progress.completed, progress.total)} of ${progress.total}…`
              : 'Calculating panels…'
          );
        } else if (progress.phase === 'preparing') {
          showExportProgress(8, 'Preparing poster…');
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
    form.append('printNumbers', String(printNumbersInput.checked));
    form.append('exportId', exportId);
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

selectOrientation('landscape', { dispatchChange: false });
applyOrientationLimits({ resetToMaximum: true });
updateLabels();
