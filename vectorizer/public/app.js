const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const imageDetails = document.getElementById('imageDetails');
const targetHeight = document.getElementById('targetHeight');
const vectorMode = document.getElementById('vectorMode');
const svgStructure = document.getElementById('svgStructure');
const monochromeSettings = document.getElementById('monochromeSettings');
const multicolorSettings = document.getElementById('multicolorSettings');
const threshold = document.getElementById('threshold');
const thresholdValue = document.getElementById('thresholdValue');
const colorCount = document.getElementById('colorCount');
const colorCountValue = document.getElementById('colorCountValue');
const removeBackground = document.getElementById('removeBackground');
const keepWhiteLayer = document.getElementById('keepWhiteLayer');
const palettePanel = document.getElementById('palettePanel');
const paletteSwatches = document.getElementById('paletteSwatches');
const showAllLayers = document.getElementById('showAllLayers');
const hideAllLayers = document.getElementById('hideAllLayers');
const maximumTraceSide = document.getElementById('maximumTraceSide');
const resolutionValue = document.getElementById('resolutionValue');
const previewButton = document.getElementById('previewButton');
const downloadButton = document.getElementById('downloadButton');
const status = document.getElementById('status');
const placeholder = document.getElementById('placeholder');
const previewImage = document.getElementById('previewImage');
const vectorPlaceholder = document.getElementById('vectorPlaceholder');
const vectorPreview = document.getElementById('vectorPreview');
const processingModal = document.getElementById('processingModal');
const processingText = document.getElementById('processingText');
const processingPercent = document.getElementById('processingPercent');
const processingProgress = document.getElementById('processingProgress');
const SETTINGS_KEY = 'ronyka-vectorizer.settings.v1';
const INKSCAPE_NAMESPACE = 'http://www.inkscape.org/namespaces/inkscape';
let file;
let previewUrl;
let vectorPreviewUrl;
let vectorDownloadUrl;
let vectorSvgText;
let resultRevision = 0;
let previewTimer;
let previewController;
let processingCloseTimer;
let activePointerSlider;
const pendingSliderUpdates = new WeakSet();

function showProcessing(percent, text) {
  if (processingCloseTimer) clearTimeout(processingCloseTimer);
  processingCloseTimer = undefined;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  processingModal.hidden = false;
  processingProgress.value = value;
  processingProgress.textContent = `${value}%`;
  processingPercent.textContent = `${value}%`;
  processingText.textContent = text;
}

function hideProcessing() {
  if (processingCloseTimer) clearTimeout(processingCloseTimer);
  processingCloseTimer = undefined;
  processingModal.hidden = true;
  processingProgress.value = 0;
  processingPercent.textContent = '0%';
  processingText.textContent = 'Preparing vectorization…';
}

function finishProcessing(success) {
  showProcessing(100, success ? 'Vector preview ready.' : 'Vectorization failed.');
  processingCloseTimer = setTimeout(hideProcessing, success ? 650 : 1200);
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    targetHeightMm: Number(targetHeight.value),
    mode: vectorMode.value,
    svgStructure: svgStructure.value,
    threshold: Number(threshold.value),
    colorCount: Number(colorCount.value),
    removeBackground: removeBackground.checked,
    keepWhiteLayer: keepWhiteLayer.checked,
    maximumTraceSide: Number(maximumTraceSide.value)
  }));
}

function restoreSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!settings) return;
    if (Number(settings.targetHeightMm) > 0) targetHeight.value = String(settings.targetHeightMm);
    if (['monochrome', 'multicolor'].includes(settings.mode)) vectorMode.value = settings.mode;
    if (['groups', 'flat'].includes(settings.svgStructure)) {
      svgStructure.value = settings.svgStructure;
    }
    if (Number(settings.threshold) >= 1 && Number(settings.threshold) <= 254) {
      threshold.value = String(settings.threshold);
    }
    if (Number(settings.maximumTraceSide) >= 500 && Number(settings.maximumTraceSide) <= 6000) {
      maximumTraceSide.value = String(settings.maximumTraceSide);
    }
    if (Number(settings.colorCount) >= 2 && Number(settings.colorCount) <= 16) {
      colorCount.value = String(settings.colorCount);
    }
    if (typeof settings.removeBackground === 'boolean') {
      removeBackground.checked = settings.removeBackground;
    }
    if (typeof settings.keepWhiteLayer === 'boolean') {
      keepWhiteLayer.checked = settings.keepWhiteLayer;
    }
  } catch {
    // Keep defaults when browser storage is unavailable or invalid.
  }
}

function updateOutputs() {
  thresholdValue.value = threshold.value;
  colorCountValue.value = colorCount.value;
  resolutionValue.value = `${maximumTraceSide.value} px`;
  const multicolor = vectorMode.value === 'multicolor';
  monochromeSettings.hidden = multicolor;
  multicolorSettings.hidden = !multicolor;
}

function clearVectorResult() {
  resultRevision += 1;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = undefined;
  previewController?.abort();
  previewController = undefined;
  hideProcessing();
  if (vectorPreviewUrl) URL.revokeObjectURL(vectorPreviewUrl);
  if (vectorDownloadUrl) URL.revokeObjectURL(vectorDownloadUrl);
  vectorPreviewUrl = undefined;
  vectorDownloadUrl = undefined;
  vectorSvgText = undefined;
  vectorPreview.removeAttribute('src');
  vectorPreview.hidden = true;
  vectorPlaceholder.hidden = false;
  paletteSwatches.replaceChildren();
  palettePanel.hidden = true;
  previewButton.disabled = !file;
  downloadButton.disabled = true;
}

function renderLayerPreview() {
  if (!vectorSvgText) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  for (const toggle of paletteSwatches.querySelectorAll('.layer-visibility')) {
    const layer = documentNode.querySelector(
      `[data-layer-root="${toggle.dataset.layer}"]`
    );
    if (layer && toggle.getAttribute('aria-pressed') !== 'true') {
      layer.setAttribute('display', 'none');
    }
  }
  const previewSvg = new XMLSerializer().serializeToString(documentNode);
  if (vectorPreviewUrl) URL.revokeObjectURL(vectorPreviewUrl);
  vectorPreviewUrl = URL.createObjectURL(
    new Blob([previewSvg], { type: 'image/svg+xml' })
  );
  vectorPreview.src = vectorPreviewUrl;
}

function refreshDownloadUrl() {
  if (vectorDownloadUrl) URL.revokeObjectURL(vectorDownloadUrl);
  vectorDownloadUrl = vectorSvgText
    ? URL.createObjectURL(new Blob([vectorSvgText], { type: 'image/svg+xml' }))
    : undefined;
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

function uniqueSvgId(documentNode, requestedId, currentElement, layerNumber) {
  const existing = documentNode.getElementById(requestedId);
  return !existing || existing === currentElement
    ? requestedId
    : `${requestedId}-layer-${layerNumber}`;
}

function renameLayer(layerNumber, name) {
  if (!vectorSvgText) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const layer = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
  if (!layer) return;
  const path = layer.localName === 'path' ? layer : layer.querySelector(':scope > path');
  const baseId = svgNameId(name);
  const pathId = uniqueSvgId(documentNode, baseId, path, layerNumber);
  const groupId = uniqueSvgId(documentNode, `${baseId}-group`, layer, layerNumber);
  if (layer.localName === 'g') {
    layer.setAttributeNS(INKSCAPE_NAMESPACE, 'inkscape:label', name);
    layer.id = groupId;
  }
  layer.dataset.name = name;
  let layerTitle = layer.querySelector(':scope > title');
  if (!layerTitle) {
    layerTitle = documentNode.createElementNS('http://www.w3.org/2000/svg', 'title');
    layer.prepend(layerTitle);
  }
  layerTitle.textContent = name;
  if (path) {
    path.id = pathId;
    path.dataset.name = name;
    let pathTitle = path.querySelector(':scope > title');
    if (!pathTitle) {
      pathTitle = documentNode.createElementNS('http://www.w3.org/2000/svg', 'title');
      path.prepend(pathTitle);
    }
    pathTitle.textContent = name;
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
}

function showPalette(palette) {
  paletteSwatches.replaceChildren();
  for (const entry of palette) {
    const row = document.createElement('div');
    row.className = 'palette-swatch';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'layer-visibility';
    toggle.dataset.layer = String(entry.layer);
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', `Hide layer ${entry.layer}, ${entry.color}`);
    toggle.title = `Hide layer ${entry.layer}`;
    toggle.textContent = '◉';
    toggle.addEventListener('click', () => {
      const visible = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(visible));
      toggle.setAttribute(
        'aria-label',
        `${visible ? 'Hide' : 'Show'} layer ${entry.layer}, ${entry.color}`
      );
      toggle.title = `${visible ? 'Hide' : 'Show'} layer ${entry.layer}`;
      toggle.textContent = visible ? '◉' : '○';
      renderLayerPreview();
    });
    const color = document.createElement('span');
    color.className = 'palette-color';
    color.style.backgroundColor = entry.color;
    const label = document.createElement('input');
    label.type = 'text';
    label.className = 'layer-name';
    label.value = entry.name || `Layer ${entry.layer}`;
    label.setAttribute('aria-label', `Name for layer ${entry.layer}`);
    label.title = 'Edit layer name';
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') label.blur();
    });
    label.addEventListener('change', () => {
      const name = label.value.trim() || `Layer ${entry.layer}`;
      label.value = name;
      renameLayer(entry.layer, name);
      status.classList.remove('error');
      status.textContent = `Renamed layer ${entry.layer}.`;
    });
    const hex = document.createElement('span');
    hex.className = 'palette-hex';
    hex.textContent = entry.color;
    row.append(toggle, color, label, hex);
    paletteSwatches.append(row);
  }
  palettePanel.hidden = palette.length === 0;
}

function setAllLayerVisibility(visible) {
  for (const toggle of paletteSwatches.querySelectorAll('.layer-visibility')) {
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.textContent = visible ? '◉' : '○';
    const layer = toggle.dataset.layer;
    toggle.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} layer ${layer}`);
    toggle.title = `${visible ? 'Hide' : 'Show'} layer ${layer}`;
  }
  renderLayerPreview();
}

showAllLayers.addEventListener('click', () => setAllLayerVisibility(true));
hideAllLayers.addEventListener('click', () => setAllLayerVisibility(false));

function selectFile(selected) {
  if (!selected) return;
  file = selected;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  previewImage.hidden = false;
  placeholder.hidden = true;
  clearVectorResult();
  previewButton.disabled = false;
  const probe = new Image();
  probe.onload = () => {
    imageDetails.textContent = `${file.name} · ${probe.naturalWidth} × ${probe.naturalHeight} px`;
  };
  probe.src = previewUrl;
  status.textContent = '';
  status.classList.remove('error');
}

imageInput.addEventListener('change', () => selectFile(imageInput.files[0]));
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  });
}
dropZone.addEventListener('drop', (event) => selectFile(event.dataTransfer.files[0]));
function scheduleAutomaticPreview(delay = 350) {
  if (previewTimer) clearTimeout(previewTimer);
  if (file && targetHeight.checkValidity()) {
    status.textContent = 'Updating vector preview…';
    previewTimer = setTimeout(() => generatePreview(), delay);
  } else {
    status.textContent = file ? 'Enter a valid artwork height.' : '';
  }
  status.classList.remove('error');
}

targetHeight.addEventListener('input', () => {
  saveSettings();
  clearVectorResult();
  scheduleAutomaticPreview();
});

const sliders = [threshold, colorCount, maximumTraceSide];

function commitSliderUpdate(slider) {
  if (!pendingSliderUpdates.has(slider)) return;
  pendingSliderUpdates.delete(slider);
  scheduleAutomaticPreview(0);
}

for (const slider of sliders) {
  slider.addEventListener('input', () => {
    pendingSliderUpdates.add(slider);
    updateOutputs();
    saveSettings();
    clearVectorResult();
    status.classList.remove('error');
    status.textContent = file ? 'Release the slider to update the preview.' : '';
  });
  slider.addEventListener('pointerdown', () => {
    activePointerSlider = slider;
  });
  slider.addEventListener('keyup', () => commitSliderUpdate(slider));
  slider.addEventListener('blur', () => commitSliderUpdate(slider));
}

window.addEventListener('pointerup', () => {
  if (!activePointerSlider) return;
  const slider = activePointerSlider;
  activePointerSlider = undefined;
  commitSliderUpdate(slider);
});

window.addEventListener('pointercancel', () => {
  activePointerSlider = undefined;
});

for (const input of [vectorMode, svgStructure, removeBackground, keepWhiteLayer]) {
  input.addEventListener('change', () => {
    updateOutputs();
    saveSettings();
    clearVectorResult();
    scheduleAutomaticPreview(0);
  });
}

async function generatePreview() {
  if (!file) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = undefined;
  clearVectorResult();
  const requestRevision = resultRevision;
  previewController = new AbortController();
  previewButton.disabled = true;
  downloadButton.disabled = true;
  status.classList.remove('error');
  status.textContent = `Vectorizing ${vectorMode.value} artwork…`;
  showProcessing(10, 'Uploading source image…');
  let vectorizingStatusTimer;
  try {
    const form = new FormData();
    form.append('image', file);
    form.append('targetHeightMm', targetHeight.value);
    form.append('mode', vectorMode.value);
    form.append('svgStructure', svgStructure.value);
    form.append('threshold', threshold.value);
    form.append('colorCount', colorCount.value);
    form.append('removeBackground', String(removeBackground.checked));
    form.append('keepWhiteLayer', String(keepWhiteLayer.checked));
    form.append('maximumTraceSide', maximumTraceSide.value);
    vectorizingStatusTimer = setTimeout(() => {
      if (requestRevision === resultRevision) {
        showProcessing(
          45,
          vectorMode.value === 'multicolor'
            ? `Tracing ${colorCount.value} color layers…`
            : 'Tracing monochrome SVG paths…'
        );
      }
    }, 250);
    const response = await fetch('/api/vectorize', {
      method: 'POST',
      body: form,
      signal: previewController.signal
    });
    clearTimeout(vectorizingStatusTimer);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Vectorization failed.');
    }
    let palette = [];
    try {
      palette = JSON.parse(decodeURIComponent(response.headers.get('X-Vector-Palette') || '[]'));
    } catch {
      // The SVG preview remains usable if optional palette metadata is absent.
    }
    const svgText = await response.text();
    if (requestRevision !== resultRevision) return;
    showProcessing(90, 'Rendering vector preview…');
    vectorSvgText = svgText;
    refreshDownloadUrl();
    showPalette(palette);
    renderLayerPreview();
    vectorPreview.hidden = false;
    vectorPlaceholder.hidden = true;
    downloadButton.disabled = false;
    status.textContent = 'Vector preview ready.';
    finishProcessing(true);
  } catch (error) {
    if (error.name === 'AbortError') return;
    status.classList.add('error');
    status.textContent = error.message;
    finishProcessing(false);
  } finally {
    if (vectorizingStatusTimer) clearTimeout(vectorizingStatusTimer);
    if (requestRevision === resultRevision) {
      previewController = undefined;
      previewButton.disabled = false;
    }
  }
}

previewButton.addEventListener('click', generatePreview);

downloadButton.addEventListener('click', () => {
  if (!vectorDownloadUrl) return;
  const link = document.createElement('a');
  link.href = vectorDownloadUrl;
  link.download = 'original-vectorized.svg';
  link.click();
  status.classList.remove('error');
  status.textContent = 'Vector SVG downloaded.';
});

restoreSettings();
updateOutputs();
