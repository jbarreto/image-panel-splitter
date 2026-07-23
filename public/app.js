const $ = (id) => document.getElementById(id);
const imageInput = $('imageInput');
const orientationInput = $('orientation');
const panelWidth = $('panelWidth');
const panelHeight = $('panelHeight');
const panelWidthValue = $('panelWidthValue');
const panelHeightValue = $('panelHeightValue');
const dpiInput = $('dpi');
const targetHeightInput = $('targetHeight');
const gridWidthInput = $('gridWidth');
const gridColorInput = $('gridColor');
const printNumbersInput = $('printNumbers');
const exportButton = $('exportButton');
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const stats = $('stats');
const status = $('status');
const dropZone = $('dropZone');
let file;
let image;

const LONG_PANEL_SIDE_IN = 9.26;
const SHORT_PANEL_SIDE_IN = 6.55;

function panelLimits() {
  const portrait = orientationInput.value === 'portrait';
  return {
    maxWidth: portrait ? SHORT_PANEL_SIDE_IN : LONG_PANEL_SIDE_IN,
    maxHeight: portrait ? LONG_PANEL_SIDE_IN : SHORT_PANEL_SIDE_IN
  };
}

function clampPanelDimensions() {
  const { maxWidth, maxHeight } = panelLimits();
  panelWidth.max = String(maxWidth);
  panelHeight.max = String(maxHeight);
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
  panelWidthValue.value = `${Number(panelWidth.value).toFixed(2)} in`;
  panelHeightValue.value = `${Number(panelHeight.value).toFixed(2)} in`;
}

function render() {
  updateLabels();
  if (!image) return;
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
  ctx.lineWidth = Math.max(1, v.gridWidthMm / 25.4 * v.dpi * previewScale);
  for (let c = 0; c <= columns; c += 1) {
    const x = Math.min(canvas.width, c * panelWidthPx * previewScale);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let r = 0; r <= rows; r += 1) {
    const y = Math.min(canvas.height, r * panelHeightPx * previewScale);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.restore();

  const widthIn = outputWidthPx / v.dpi;
  const heightIn = outputHeightPx / v.dpi;
  stats.textContent = `${columns} columns × ${rows} rows = ${columns * rows} panels · Poster ${widthIn.toFixed(2)} × ${heightIn.toFixed(2)} in`;
}

async function loadFile(selected) {
  if (!selected) return;
  file = selected;
  const url = URL.createObjectURL(file);
  image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    exportButton.disabled = false;
    status.textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight} px`;
    render();
  };
  image.src = url;
}

imageInput.addEventListener('change', () => loadFile(imageInput.files[0]));
orientationInput.addEventListener('change', () => {
  applyOrientationLimits({ resetToMaximum: true });
  render();
});
for (const input of [panelWidth, panelHeight, dpiInput, targetHeightInput, gridWidthInput, gridColorInput]) {
  input.addEventListener('input', render);
}
window.addEventListener('resize', render);

for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); });
}
dropZone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));

exportButton.addEventListener('click', async () => {
  if (!file) return;
  exportButton.disabled = true;
  status.textContent = 'Generating panels…';
  try {
    const v = values();
    const form = new FormData();
    form.append('image', file);
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
    const response = await fetch('/api/export', { method: 'POST', body: form });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Export failed.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'poster-panels.zip';
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = 'Export complete.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    exportButton.disabled = false;
  }
});

applyOrientationLimits();
updateLabels();
