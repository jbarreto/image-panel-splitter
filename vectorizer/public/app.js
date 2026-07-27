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
const fillColorGaps = document.getElementById('fillColorGaps');
const palettePanel = document.getElementById('palettePanel');
const paletteSwatches = document.getElementById('paletteSwatches');
const showAllLayers = document.getElementById('showAllLayers');
const hideAllLayers = document.getElementById('hideAllLayers');
const undoLayerEdit = document.getElementById('undoLayerEdit');
const redoLayerEdit = document.getElementById('redoLayerEdit');
const mergeSelectedLayers = document.getElementById('mergeSelectedLayers');
const resetLayerPositions = document.getElementById('resetLayerPositions');
const layerStrokeWidth = document.getElementById('layerStrokeWidth');
const layerStrokeValue = document.getElementById('layerStrokeValue');
const previewGrid = document.getElementById('previewGrid');
const sourcePreviewToggle = document.getElementById('sourcePreviewToggle');
const sourcePreviewCard = previewGrid.querySelector('.source-preview-card');
const sourcePreviewCaption = sourcePreviewCard.querySelector('figcaption');
const sourcePreviewResize = document.getElementById('sourcePreviewResize');
const sourcePreviewHide = document.getElementById('sourcePreviewHide');
const sourcePreviewRestore = document.getElementById('sourcePreviewRestore');
const vectorCursorTool = document.getElementById('vectorCursorTool');
const vectorZoomOut = document.getElementById('vectorZoomOut');
const vectorZoomIn = document.getElementById('vectorZoomIn');
const vectorZoomValue = document.getElementById('vectorZoomValue');
const maximumTraceSide = document.getElementById('maximumTraceSide');
const resolutionValue = document.getElementById('resolutionValue');
const curveSmoothing = document.getElementById('curveSmoothing');
const curveSmoothingValue = document.getElementById('curveSmoothingValue');
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
let vectorDownloadUrl;
let vectorSvgText;
let draggedPreviewLayer;
let draggedPaletteLayer;
let currentPalette = [];
let pendingLayerConfiguration;
let activeSoloLayer;
let soloVisibilitySnapshot;
let resultRevision = 0;
let previewTimer;
let previewController;
let processingCloseTimer;
let activePointerSlider;
let activeLayerStrokePointer = false;
let layerStrokePending = false;
let sourcePreviewInteraction;
let vectorPreviewZoom = 1;
let vectorZoomTool;
let layerUndoHistory = [];
let layerRedoHistory = [];
const pendingSliderUpdates = new WeakSet();

function updateLayerHistoryControls() {
  undoLayerEdit.disabled = layerUndoHistory.length === 0;
  redoLayerEdit.disabled = layerRedoHistory.length === 0;
}

function layerHistoryState() {
  if (!vectorSvgText) return;
  return {
    svgText: vectorSvgText,
    palette: currentPalette.map((entry) => ({ ...entry })),
    layers: currentPalette.map((entry) => {
      const row = paletteSwatches.querySelector(
        `.palette-swatch[data-layer="${entry.layer}"]`
      );
      return {
        visible: row?.querySelector('.layer-visibility')?.getAttribute('aria-pressed') !== 'false',
        selected: Boolean(row?.querySelector('.layer-selection')?.checked)
      };
    })
  };
}

function pushLayerHistory() {
  const state = layerHistoryState();
  if (!state) return;
  layerUndoHistory.push(state);
  if (layerUndoHistory.length > 10) layerUndoHistory.shift();
  layerRedoHistory = [];
  updateLayerHistoryControls();
}

function clearLayerHistory() {
  layerUndoHistory = [];
  layerRedoHistory = [];
  updateLayerHistoryControls();
}

function restoreLayerHistoryState(state) {
  vectorSvgText = state.svgText;
  currentPalette = state.palette.map((entry) => ({ ...entry }));
  refreshDownloadUrl();
  showPalette(currentPalette);
  restoreLayerPanelState(state.layers);
  renderLayerPreview();
  updateLayerHistoryControls();
}

function undoLayerChange() {
  if (layerUndoHistory.length === 0) return;
  const current = layerHistoryState();
  if (current) {
    layerRedoHistory.push(current);
    if (layerRedoHistory.length > 10) layerRedoHistory.shift();
  }
  restoreLayerHistoryState(layerUndoHistory.pop());
  status.classList.remove('error');
  status.textContent = 'Undid the last layer edit.';
}

function redoLayerChange() {
  if (layerRedoHistory.length === 0) return;
  const current = layerHistoryState();
  if (current) {
    layerUndoHistory.push(current);
    if (layerUndoHistory.length > 10) layerUndoHistory.shift();
  }
  restoreLayerHistoryState(layerRedoHistory.pop());
  status.classList.remove('error');
  status.textContent = 'Redid the last layer edit.';
}

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
    fillColorGaps: fillColorGaps.checked,
    maximumTraceSide: Number(maximumTraceSide.value),
    curveSmoothing: Number(curveSmoothing.value)
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
    if (Number(settings.curveSmoothing) >= 0 && Number(settings.curveSmoothing) <= 100) {
      curveSmoothing.value = String(settings.curveSmoothing);
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
    if (typeof settings.fillColorGaps === 'boolean') {
      fillColorGaps.checked = settings.fillColorGaps;
    }
  } catch {
    // Keep defaults when browser storage is unavailable or invalid.
  }
}

function updateOutputs() {
  thresholdValue.value = threshold.value;
  colorCountValue.value = colorCount.value;
  resolutionValue.value = `${maximumTraceSide.value} px`;
  curveSmoothingValue.value = `${curveSmoothing.value}%`;
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
  if (vectorDownloadUrl) URL.revokeObjectURL(vectorDownloadUrl);
  vectorDownloadUrl = undefined;
  vectorSvgText = undefined;
  currentPalette = [];
  activeSoloLayer = undefined;
  soloVisibilitySnapshot = undefined;
  mergeSelectedLayers.disabled = true;
  layerStrokeWidth.disabled = true;
  layerStrokeWidth.value = '0';
  layerStrokeValue.value = '0 px';
  draggedPreviewLayer = undefined;
  vectorPreview.classList.remove('dragging-layer');
  vectorPreview.replaceChildren();
  vectorPreview.hidden = true;
  vectorPlaceholder.hidden = false;
  paletteSwatches.replaceChildren();
  palettePanel.hidden = true;
  previewButton.disabled = !file;
  downloadButton.disabled = true;
  clearLayerHistory();
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
  const inlineSvg = document.importNode(documentNode.documentElement, true);
  inlineSvg.removeAttribute('width');
  inlineSvg.removeAttribute('height');
  inlineSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  vectorPreview.replaceChildren(inlineSvg);
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

function renameLayerInDocument(documentNode, layerNumber, name) {
  const layer = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
  if (!layer) return false;
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
  return true;
}

function renameLayer(layerNumber, name) {
  if (!vectorSvgText) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  if (!renameLayerInDocument(documentNode, layerNumber, name)) return;
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  const entry = currentPalette.find(
    (paletteEntry) => Number(paletteEntry.layer) === Number(layerNumber)
  );
  if (entry) entry.name = name;
  refreshDownloadUrl();
}

function captureLayerConfiguration() {
  if (!vectorSvgText || currentPalette.length === 0) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const layers = currentPalette.map((entry) => {
    const layerNumber = Number(entry.layer);
    const root = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
    const row = paletteSwatches.querySelector(
      `.palette-swatch[data-layer="${layerNumber}"]`
    );
    return {
      name: row?.querySelector('.layer-name')?.value.trim() || entry.name,
      visible:
        row?.querySelector('.layer-visibility')?.getAttribute('aria-pressed') !== 'false',
      selected: Boolean(row?.querySelector('.layer-selection')?.checked),
      translateX: root?.dataset.translateX,
      translateY: root?.dataset.translateY,
      strokeWidth: Number(root?.dataset.fillStrokeWidth || 0)
    };
  });
  const originalLayerIndexes = new Set(
    [...documentNode.querySelectorAll('path[data-layer-index]')]
      .map((path) => path.dataset.layerIndex)
  );
  pendingLayerConfiguration = {
    svgTemplate: vectorSvgText,
    baseLayerCount: originalLayerIndexes.size,
    palette: currentPalette.map((entry) => ({ ...entry })),
    layers
  };
}

function restoreLayerConfiguration(palette) {
  const snapshot = pendingLayerConfiguration;
  pendingLayerConfiguration = undefined;
  if (!snapshot || snapshot.baseLayerCount !== palette.length) {
    return { palette, restored: false };
  }
  const generatedDocument = new DOMParser().parseFromString(
    vectorSvgText,
    'image/svg+xml'
  );
  const templateDocument = new DOMParser().parseFromString(
    snapshot.svgTemplate,
    'image/svg+xml'
  );
  if (
    generatedDocument.querySelector('parsererror') ||
    templateDocument.querySelector('parsererror')
  ) {
    return { palette, restored: false };
  }
  const generatedPaths = new Map(
    [...generatedDocument.querySelectorAll('path[data-layer-index]')]
      .map((path) => [path.dataset.layerIndex, path])
  );
  let replacedPaths = 0;
  for (const path of templateDocument.querySelectorAll('path[data-layer-index]')) {
    const generatedPath = generatedPaths.get(path.dataset.layerIndex);
    if (!generatedPath) continue;
    path.setAttribute('d', generatedPath.getAttribute('d'));
    replacedPaths += 1;
  }
  if (replacedPaths < snapshot.baseLayerCount) {
    return { palette, restored: false };
  }
  const generatedRoot = generatedDocument.documentElement;
  const templateRoot = templateDocument.documentElement;
  for (const attribute of ['width', 'height', 'viewBox']) {
    const value = generatedRoot.getAttribute(attribute);
    if (value !== null) templateRoot.setAttribute(attribute, value);
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(templateDocument)}\n`;
  return {
    palette: snapshot.palette.map((entry, index) => ({
      ...entry,
      name: snapshot.layers[index]?.name || entry.name
    })),
    restored: true,
    configuration: snapshot.layers
  };
}

function highlightLayerRow(layerNumber) {
  for (const row of paletteSwatches.querySelectorAll('.palette-swatch')) {
    row.classList.toggle('preview-hover', row.dataset.layer === String(layerNumber));
  }
}

function highlightPreviewLayer(layerNumber) {
  const roots = vectorPreview.querySelectorAll('[data-layer-root]');
  const active = layerNumber !== undefined;
  vectorPreview.classList.toggle('list-layer-hovering', active);
  for (const root of roots) {
    root.classList.toggle(
      'list-hover-highlight',
      active && root.dataset.layerRoot === String(layerNumber)
    );
  }
}

function previewPoint(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

function saveLayerPosition(layerNumber, translateX, translateY) {
  if (!vectorSvgText) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const layer = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
  if (!layer) return;
  layer.dataset.translateX = String(translateX);
  layer.dataset.translateY = String(translateY);
  layer.setAttribute('transform', `translate(${translateX} ${translateY})`);
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
}

function resetAllLayerPositions() {
  if (!vectorSvgText) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  pushLayerHistory();
  for (const layer of documentNode.querySelectorAll(
    '[data-translate-x], [data-translate-y]'
  )) {
    layer.removeAttribute('data-translate-x');
    layer.removeAttribute('data-translate-y');
    layer.removeAttribute('transform');
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent = 'Layer positions reset.';
}

function selectedLayerNumbers() {
  return [...paletteSwatches.querySelectorAll('.layer-selection:checked')]
    .map((checkbox) => Number(checkbox.dataset.layer));
}

function updateLayerSelectionControls() {
  const selectedLayers = selectedLayerNumbers();
  mergeSelectedLayers.disabled = selectedLayers.length < 2;
  layerStrokeWidth.disabled = selectedLayers.length === 0;
  if (selectedLayers.length === 0) {
    layerStrokeWidth.value = '0';
    layerStrokeValue.value = '0 px';
    return;
  }
  const selectedRoot = vectorPreview.querySelector(
    `[data-layer-root="${selectedLayers[0]}"]`
  );
  const width = Number(selectedRoot?.dataset.fillStrokeWidth || 0);
  layerStrokeWidth.value = String(width);
  layerStrokeValue.value = `${width} px`;
}

function mergeSelectedLayerEntries() {
  const selectedLayers = selectedLayerNumbers();
  if (selectedLayers.length < 2 || !vectorSvgText) return;
  const selectedSet = new Set(selectedLayers);
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const roots = [...documentNode.querySelectorAll('[data-layer-root]')]
    .filter((layer) => selectedSet.has(Number(layer.dataset.layerRoot)));
  if (roots.length < 2) return;
  pushLayerHistory();

  const mergedLayerNumber = selectedLayers[0];
  const mergedName = `Grouped ${selectedLayers.length} layers`;
  const mergedGroup = documentNode.createElementNS('http://www.w3.org/2000/svg', 'g');
  mergedGroup.id = uniqueSvgId(
    documentNode,
    `merged-layer-${mergedLayerNumber}-group`,
    mergedGroup,
    mergedLayerNumber
  );
  mergedGroup.dataset.layerRoot = String(mergedLayerNumber);
  mergedGroup.dataset.layerIndex = String(mergedLayerNumber);
  mergedGroup.dataset.name = mergedName;
  mergedGroup.setAttributeNS(INKSCAPE_NAMESPACE, 'inkscape:groupmode', 'layer');
  mergedGroup.setAttributeNS(INKSCAPE_NAMESPACE, 'inkscape:label', mergedName);
  const title = documentNode.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = mergedName;
  mergedGroup.append(title);

  const lastRoot = roots.at(-1);
  lastRoot.parentNode.insertBefore(mergedGroup, lastRoot.nextSibling);
  for (const root of roots) {
    root.removeAttribute('data-layer-root');
    root.removeAttributeNS(INKSCAPE_NAMESPACE, 'groupmode');
    root.removeAttributeNS(INKSCAPE_NAMESPACE, 'label');
    mergedGroup.append(root);
  }

  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  const lastSelectedIndex = Math.max(
    ...currentPalette.map((entry, index) => (
      selectedSet.has(Number(entry.layer)) ? index : -1
    ))
  );
  const mergedPalette = currentPalette.filter(
    (entry) => !selectedSet.has(Number(entry.layer))
  );
  const insertionIndex = currentPalette
    .slice(0, lastSelectedIndex + 1)
    .filter((entry) => !selectedSet.has(Number(entry.layer))).length;
  mergedPalette.splice(insertionIndex, 0, {
    layer: mergedLayerNumber,
    color: 'Mixed',
    name: mergedName
  });
  showPalette(mergedPalette);
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent = `Grouped ${selectedLayers.length} layers.`;
}

function pathsInLayer(root) {
  return root.localName === 'path' ? [root] : [...root.querySelectorAll('path')];
}

function mergeLayerIntoColor(sourceLayerNumber, targetLayerNumber) {
  if (!vectorSvgText || sourceLayerNumber === targetLayerNumber) return;
  const targetEntry = currentPalette.find(
    (entry) => Number(entry.layer) === Number(targetLayerNumber)
  );
  if (!targetEntry || !/^#[0-9a-f]{6}$/i.test(targetEntry.color)) {
    status.classList.add('error');
    status.textContent = 'Choose a solid-color layer as the merge target.';
    return;
  }
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const sourceRoot = documentNode.querySelector(
    `[data-layer-root="${sourceLayerNumber}"]`
  );
  let targetRoot = documentNode.querySelector(
    `[data-layer-root="${targetLayerNumber}"]`
  );
  if (!sourceRoot || !targetRoot) return;
  pushLayerHistory();

  for (const path of pathsInLayer(sourceRoot)) {
    path.setAttribute('fill', targetEntry.color);
    if (path.hasAttribute('stroke')) path.setAttribute('stroke', targetEntry.color);
  }
  sourceRoot.removeAttribute('data-layer-root');
  sourceRoot.removeAttributeNS(INKSCAPE_NAMESPACE, 'groupmode');
  sourceRoot.removeAttributeNS(INKSCAPE_NAMESPACE, 'label');

  if (targetRoot.localName === 'path') {
    const targetName = targetEntry.name || `Layer ${targetLayerNumber}`;
    const targetGroup = documentNode.createElementNS('http://www.w3.org/2000/svg', 'g');
    targetGroup.id = uniqueSvgId(
      documentNode,
      `${svgNameId(targetName)}-group`,
      targetGroup,
      targetLayerNumber
    );
    targetGroup.dataset.layerRoot = String(targetLayerNumber);
    targetGroup.dataset.layerIndex = String(targetLayerNumber);
    targetGroup.dataset.name = targetName;
    targetGroup.dataset.color = targetEntry.color;
    targetGroup.setAttributeNS(INKSCAPE_NAMESPACE, 'inkscape:groupmode', 'layer');
    targetGroup.setAttributeNS(INKSCAPE_NAMESPACE, 'inkscape:label', targetName);
    const title = documentNode.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = targetName;
    targetGroup.append(title);
    targetRoot.parentNode.insertBefore(targetGroup, targetRoot);
    targetRoot.removeAttribute('data-layer-root');
    targetGroup.append(targetRoot);
    targetRoot = targetGroup;
  }
  targetRoot.dataset.color = targetEntry.color;
  targetRoot.append(sourceRoot);

  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  showPalette(currentPalette.filter(
    (entry) => Number(entry.layer) !== Number(sourceLayerNumber)
  ));
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent =
    `Merged layer ${sourceLayerNumber} into ${targetEntry.name || `layer ${targetLayerNumber}`} using ${targetEntry.color}.`;
}

function clearPaletteMergeTarget() {
  for (const row of paletteSwatches.querySelectorAll('.palette-swatch')) {
    row.classList.remove('color-merge-target');
  }
}

function applyStrokeToLayerRoot(root, width) {
  if (width > 0) {
    root.dataset.fillStrokeWidth = String(width);
  } else {
    root.removeAttribute('data-fill-stroke-width');
  }
  const paths = root.localName === 'path' ? [root] : [...root.querySelectorAll('path')];
  for (const path of paths) {
    if (width > 0) {
      path.setAttribute('stroke', path.getAttribute('fill') || '#000000');
      path.setAttribute('stroke-width', String(width));
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('paint-order', 'stroke fill');
    } else {
      for (const attribute of [
        'stroke',
        'stroke-width',
        'stroke-linejoin',
        'stroke-linecap',
        'paint-order'
      ]) {
        path.removeAttribute(attribute);
      }
    }
  }
}

function previewSelectedLayerStroke(width) {
  for (const layerNumber of selectedLayerNumbers()) {
    const root = vectorPreview.querySelector(`[data-layer-root="${layerNumber}"]`);
    if (root) applyStrokeToLayerRoot(root, width);
  }
}

function commitSelectedLayerStroke() {
  if (!layerStrokePending || !vectorSvgText) return;
  layerStrokePending = false;
  const selectedLayers = selectedLayerNumbers();
  const width = Number(layerStrokeWidth.value);
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  pushLayerHistory();
  for (const layerNumber of selectedLayers) {
    const root = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
    if (root) applyStrokeToLayerRoot(root, width);
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent = width > 0
    ? `Applied a ${width}px fill stroke to ${selectedLayers.length} selected layer${selectedLayers.length === 1 ? '' : 's'}.`
    : 'Removed the fill stroke from the selected layers.';
}

vectorPreview.addEventListener('pointermove', (event) => {
  if (draggedPreviewLayer) {
    const point = previewPoint(draggedPreviewLayer.svg, event);
    if (!point) return;
    draggedPreviewLayer.translateX =
      draggedPreviewLayer.originalX + point.x - draggedPreviewLayer.startX;
    draggedPreviewLayer.translateY =
      draggedPreviewLayer.originalY + point.y - draggedPreviewLayer.startY;
    draggedPreviewLayer.element.setAttribute(
      'transform',
      `translate(${draggedPreviewLayer.translateX} ${draggedPreviewLayer.translateY})`
    );
    return;
  }
  const layer = event.target.closest?.('[data-layer-root]');
  highlightLayerRow(layer?.dataset.layerRoot);
});

vectorPreview.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (vectorZoomTool) {
    event.preventDefault();
    event.stopPropagation();
    const zoomStep = vectorZoomTool === 'in' ? 0.25 : -0.25;
    setVectorPreviewZoom(vectorPreviewZoom + zoomStep, event);
    status.classList.remove('error');
    status.textContent = `Vector preview zoomed to ${Math.round(vectorPreviewZoom * 100)}%.`;
    return;
  }
  const layer = event.target.closest?.('[data-layer-root]');
  const svg = vectorPreview.querySelector('svg');
  if (!layer || !svg) return;
  const point = previewPoint(svg, event);
  if (!point) return;
  event.preventDefault();
  const layerNumber = layer.dataset.layerRoot;
  draggedPreviewLayer = {
    element: layer,
    svg,
    layerNumber,
    startX: point.x,
    startY: point.y,
    originalX: Number(layer.dataset.translateX || 0),
    originalY: Number(layer.dataset.translateY || 0),
    translateX: Number(layer.dataset.translateX || 0),
    translateY: Number(layer.dataset.translateY || 0)
  };
  vectorPreview.setPointerCapture(event.pointerId);
  vectorPreview.classList.add('dragging-layer');
  highlightLayerRow(layerNumber);
});

vectorPreview.addEventListener('pointerup', (event) => {
  if (!draggedPreviewLayer) return;
  const movedLayer = draggedPreviewLayer;
  draggedPreviewLayer = undefined;
  if (vectorPreview.hasPointerCapture(event.pointerId)) {
    vectorPreview.releasePointerCapture(event.pointerId);
  }
  vectorPreview.classList.remove('dragging-layer');
  if (
    movedLayer.translateX !== movedLayer.originalX
    || movedLayer.translateY !== movedLayer.originalY
  ) {
    pushLayerHistory();
  }
  saveLayerPosition(
    movedLayer.layerNumber,
    movedLayer.translateX,
    movedLayer.translateY
  );
  status.classList.remove('error');
  status.textContent = `Moved layer ${movedLayer.layerNumber}.`;
});

vectorPreview.addEventListener('pointercancel', () => {
  draggedPreviewLayer = undefined;
  vectorPreview.classList.remove('dragging-layer');
  renderLayerPreview();
});

vectorPreview.addEventListener('pointerleave', () => {
  if (!draggedPreviewLayer) highlightLayerRow();
});

function showPalette(palette) {
  activeSoloLayer = undefined;
  soloVisibilitySnapshot = undefined;
  currentPalette = palette.map((entry) => ({ ...entry }));
  paletteSwatches.replaceChildren();
  for (const entry of palette) {
    const row = document.createElement('div');
    row.className = 'palette-swatch';
    row.dataset.layer = String(entry.layer);
    row.addEventListener('mouseenter', () => highlightPreviewLayer(entry.layer));
    row.addEventListener('mouseleave', () => highlightPreviewLayer());
    const selection = document.createElement('input');
    selection.type = 'checkbox';
    selection.className = 'layer-selection';
    selection.dataset.layer = String(entry.layer);
    selection.setAttribute('aria-label', `Select ${entry.name || `layer ${entry.layer}`} for merging`);
    selection.title = 'Select layer for merging';
    selection.addEventListener('change', () => {
      row.classList.toggle('merge-selected', selection.checked);
      updateLayerSelectionControls();
    });
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'layer-visibility';
    toggle.dataset.layer = String(entry.layer);
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', `Hide layer ${entry.layer}, ${entry.color}`);
    toggle.title = `Hide layer ${entry.layer}`;
    toggle.textContent = '◉';
    toggle.addEventListener('click', () => {
      pushLayerHistory();
      activeSoloLayer = undefined;
      soloVisibilitySnapshot = undefined;
      for (const solo of paletteSwatches.querySelectorAll('.layer-solo')) {
        solo.classList.remove('solo-active');
        solo.setAttribute('aria-pressed', 'false');
      }
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
    const solo = document.createElement('button');
    solo.type = 'button';
    solo.className = 'layer-solo';
    solo.dataset.layer = String(entry.layer);
    solo.setAttribute('aria-pressed', 'false');
    solo.setAttribute('aria-label', `Show only layer ${entry.layer}`);
    solo.title = 'Show only this layer';
    solo.textContent = 'S';
    solo.addEventListener('click', () => {
      pushLayerHistory();
      if (activeSoloLayer === Number(entry.layer) && soloVisibilitySnapshot) {
        for (const visibility of paletteSwatches.querySelectorAll('.layer-visibility')) {
          const visible = soloVisibilitySnapshot.get(visibility.dataset.layer) !== false;
          visibility.setAttribute('aria-pressed', String(visible));
          visibility.textContent = visible ? '◉' : '○';
          visibility.setAttribute(
            'aria-label',
            `${visible ? 'Hide' : 'Show'} layer ${visibility.dataset.layer}`
          );
          visibility.title =
            `${visible ? 'Hide' : 'Show'} layer ${visibility.dataset.layer}`;
        }
        activeSoloLayer = undefined;
        soloVisibilitySnapshot = undefined;
        for (const button of paletteSwatches.querySelectorAll('.layer-solo')) {
          button.classList.remove('solo-active');
          button.setAttribute('aria-pressed', 'false');
        }
        renderLayerPreview();
        return;
      }
      if (!soloVisibilitySnapshot) {
        soloVisibilitySnapshot = new Map(
          [...paletteSwatches.querySelectorAll('.layer-visibility')]
            .map((visibility) => [
              visibility.dataset.layer,
              visibility.getAttribute('aria-pressed') === 'true'
            ])
        );
      }
      activeSoloLayer = Number(entry.layer);
      for (const visibility of paletteSwatches.querySelectorAll('.layer-visibility')) {
        const visible = visibility.dataset.layer === String(entry.layer);
        visibility.setAttribute('aria-pressed', String(visible));
        visibility.textContent = visible ? '◉' : '○';
        visibility.setAttribute(
          'aria-label',
          `${visible ? 'Hide' : 'Show'} layer ${visibility.dataset.layer}`
        );
        visibility.title =
          `${visible ? 'Hide' : 'Show'} layer ${visibility.dataset.layer}`;
      }
      for (const button of paletteSwatches.querySelectorAll('.layer-solo')) {
        const active = button === solo;
        button.classList.toggle('solo-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      renderLayerPreview();
    });
    const color = document.createElement('span');
    color.className = 'palette-color';
    if (entry.color === 'Mixed') {
      color.classList.add('mixed-color');
    } else {
      color.style.backgroundColor = entry.color;
    }
    color.draggable = true;
    color.title = 'Drag onto another color to merge';
    color.addEventListener('dragstart', (event) => {
      draggedPaletteLayer = Number(entry.layer);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(entry.layer));
      row.classList.add('color-merge-source');
    });
    color.addEventListener('dragover', (event) => {
      if (
        draggedPaletteLayer === undefined ||
        draggedPaletteLayer === Number(entry.layer)
      ) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      clearPaletteMergeTarget();
      row.classList.add('color-merge-target');
    });
    color.addEventListener('drop', (event) => {
      event.preventDefault();
      const sourceLayer = Number(
        event.dataTransfer.getData('text/plain') || draggedPaletteLayer
      );
      clearPaletteMergeTarget();
      draggedPaletteLayer = undefined;
      mergeLayerIntoColor(sourceLayer, Number(entry.layer));
    });
    color.addEventListener('dragend', () => {
      draggedPaletteLayer = undefined;
      row.classList.remove('color-merge-source');
      clearPaletteMergeTarget();
    });
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
      pushLayerHistory();
      renameLayer(entry.layer, name);
      status.classList.remove('error');
      status.textContent = `Renamed layer ${entry.layer}.`;
    });
    const hex = document.createElement('span');
    hex.className = 'palette-hex';
    hex.textContent = entry.color;
    row.append(selection, toggle, solo, color, label, hex);
    paletteSwatches.append(row);
  }
  updateLayerSelectionControls();
  palettePanel.hidden = palette.length === 0;
}

function restoreLayerPanelState(configuration) {
  if (!configuration) return;
  configuration.forEach((config, index) => {
    const row = paletteSwatches.children[index];
    if (!row) return;
    const visibility = row.querySelector('.layer-visibility');
    if (visibility && !config.visible) {
      visibility.setAttribute('aria-pressed', 'false');
      visibility.textContent = '○';
      visibility.setAttribute('aria-label', `Show layer ${row.dataset.layer}`);
      visibility.title = `Show layer ${row.dataset.layer}`;
    }
    const selection = row.querySelector('.layer-selection');
    if (selection && config.selected) {
      selection.checked = true;
      row.classList.add('merge-selected');
    }
  });
  updateLayerSelectionControls();
}

function setAllLayerVisibility(visible) {
  pushLayerHistory();
  activeSoloLayer = undefined;
  soloVisibilitySnapshot = undefined;
  for (const solo of paletteSwatches.querySelectorAll('.layer-solo')) {
    solo.classList.remove('solo-active');
    solo.setAttribute('aria-pressed', 'false');
  }
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
undoLayerEdit.addEventListener('click', undoLayerChange);
redoLayerEdit.addEventListener('click', redoLayerChange);
mergeSelectedLayers.addEventListener('click', mergeSelectedLayerEntries);
resetLayerPositions.addEventListener('click', resetAllLayerPositions);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && vectorZoomTool) {
    vectorZoomTool = undefined;
    updateVectorZoomTool();
    status.textContent = '';
    return;
  }
  const editingText = event.target.matches?.(
    'input[type="text"], input[type="number"], textarea, [contenteditable="true"]'
  );
  if (editingText || !(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoLayerChange();
    else undoLayerChange();
  } else if (key === 'y' && !event.shiftKey) {
    event.preventDefault();
    redoLayerChange();
  }
});

layerStrokeWidth.addEventListener('input', () => {
  const width = Number(layerStrokeWidth.value);
  layerStrokePending = true;
  layerStrokeValue.value = `${width} px`;
  previewSelectedLayerStroke(width);
  status.classList.remove('error');
  status.textContent = 'Release the slider to save the selected layer stroke.';
});
layerStrokeWidth.addEventListener('pointerdown', () => {
  activeLayerStrokePointer = true;
});
layerStrokeWidth.addEventListener('keyup', commitSelectedLayerStroke);
layerStrokeWidth.addEventListener('blur', commitSelectedLayerStroke);

sourcePreviewToggle.addEventListener('click', () => {
  const split = previewGrid.classList.toggle('split-comparison');
  sourcePreviewToggle.textContent = split ? 'Picture in picture' : 'Split view';
  sourcePreviewToggle.setAttribute('aria-pressed', String(split));
  sourcePreviewToggle.setAttribute(
    'aria-label',
    split
      ? 'Use picture-in-picture source preview'
      : 'Compare source and vector side by side'
  );
  sourcePreviewToggle.title = split
    ? 'Use picture-in-picture source preview'
    : 'Compare source and vector side by side';
  if (!split) requestAnimationFrame(constrainSourcePreview);
});

sourcePreviewHide.addEventListener('click', () => {
  previewGrid.classList.add('source-hidden');
  sourcePreviewCard.hidden = true;
  sourcePreviewRestore.hidden = false;
  sourcePreviewToggle.hidden = true;
});

sourcePreviewRestore.addEventListener('click', () => {
  previewGrid.classList.remove('source-hidden');
  sourcePreviewCard.hidden = false;
  sourcePreviewRestore.hidden = true;
  sourcePreviewToggle.hidden = false;
  requestAnimationFrame(constrainSourcePreview);
});

function updateVectorZoomTool() {
  vectorCursorTool.classList.toggle('active', !vectorZoomTool);
  vectorZoomIn.classList.toggle('active', vectorZoomTool === 'in');
  vectorZoomOut.classList.toggle('active', vectorZoomTool === 'out');
  vectorCursorTool.setAttribute('aria-pressed', String(!vectorZoomTool));
  vectorZoomIn.setAttribute('aria-pressed', String(vectorZoomTool === 'in'));
  vectorZoomOut.setAttribute('aria-pressed', String(vectorZoomTool === 'out'));
  vectorPreview.classList.toggle('zoom-in-tool', vectorZoomTool === 'in');
  vectorPreview.classList.toggle('zoom-out-tool', vectorZoomTool === 'out');
}

function selectVectorZoomTool(tool) {
  vectorZoomTool = vectorZoomTool === tool ? undefined : tool;
  updateVectorZoomTool();
  status.classList.remove('error');
  status.textContent = vectorZoomTool
    ? `Zoom ${vectorZoomTool} selected. Click the vector preview.`
    : '';
}

function setVectorPreviewZoom(nextZoom, focalEvent) {
  if (focalEvent) {
    const bounds = vectorPreview.getBoundingClientRect();
    const originX = ((focalEvent.clientX - bounds.left) / bounds.width) * 100;
    const originY = ((focalEvent.clientY - bounds.top) / bounds.height) * 100;
    vectorPreview.style.setProperty(
      '--vector-preview-origin-x',
      `${Math.max(0, Math.min(100, originX))}%`
    );
    vectorPreview.style.setProperty(
      '--vector-preview-origin-y',
      `${Math.max(0, Math.min(100, originY))}%`
    );
  }
  vectorPreviewZoom = Math.max(0.5, Math.min(4, nextZoom));
  vectorPreview.style.setProperty('--vector-preview-zoom', vectorPreviewZoom);
  vectorZoomValue.textContent = `${Math.round(vectorPreviewZoom * 100)}%`;
  vectorZoomOut.disabled = vectorPreviewZoom <= 0.5;
  vectorZoomIn.disabled = vectorPreviewZoom >= 4;
}

vectorCursorTool.addEventListener('click', () => {
  vectorZoomTool = undefined;
  updateVectorZoomTool();
  status.textContent = '';
});
vectorZoomOut.addEventListener('click', () => selectVectorZoomTool('out'));
vectorZoomIn.addEventListener('click', () => selectVectorZoomTool('in'));
vectorZoomValue.addEventListener('click', () => {
  vectorZoomTool = undefined;
  updateVectorZoomTool();
  vectorPreview.style.removeProperty('--vector-preview-origin-x');
  vectorPreview.style.removeProperty('--vector-preview-origin-y');
  setVectorPreviewZoom(1);
});

function sourcePreviewMetrics() {
  const gridRect = previewGrid.getBoundingClientRect();
  const cardRect = sourcePreviewCard.getBoundingClientRect();
  return { gridRect, cardRect };
}

function setSourcePreviewGeometry(left, top, width, stageHeight) {
  sourcePreviewCard.style.setProperty('--pip-left', `${Math.round(left)}px`);
  sourcePreviewCard.style.setProperty('--pip-top', `${Math.round(top)}px`);
  sourcePreviewCard.style.setProperty('--pip-width', `${Math.round(width)}px`);
  sourcePreviewCard.style.setProperty('--pip-stage-height', `${Math.round(stageHeight)}px`);
}

function constrainSourcePreview() {
  if (previewGrid.classList.contains('split-comparison')) return;
  const { gridRect, cardRect } = sourcePreviewMetrics();
  const left = Math.max(0, Math.min(cardRect.left - gridRect.left, gridRect.width - cardRect.width));
  const top = Math.max(0, Math.min(cardRect.top - gridRect.top, gridRect.height - cardRect.height));
  sourcePreviewCard.style.setProperty('--pip-left', `${Math.round(left)}px`);
  sourcePreviewCard.style.setProperty('--pip-top', `${Math.round(top)}px`);
}

sourcePreviewCaption.addEventListener('pointerdown', (event) => {
  if (
    previewGrid.classList.contains('split-comparison')
    || event.button !== 0
    || event.target.closest('button')
  ) return;
  const { gridRect, cardRect } = sourcePreviewMetrics();
  sourcePreviewInteraction = {
    type: 'move',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: cardRect.left - gridRect.left,
    top: cardRect.top - gridRect.top
  };
  sourcePreviewCaption.setPointerCapture(event.pointerId);
  sourcePreviewCard.classList.add('moving');
  event.preventDefault();
});

sourcePreviewCaption.addEventListener('pointermove', (event) => {
  if (sourcePreviewInteraction?.type !== 'move'
    || sourcePreviewInteraction.pointerId !== event.pointerId) return;
  const { gridRect, cardRect } = sourcePreviewMetrics();
  const left = Math.max(
    0,
    Math.min(
      sourcePreviewInteraction.left + event.clientX - sourcePreviewInteraction.startX,
      gridRect.width - cardRect.width
    )
  );
  const top = Math.max(
    0,
    Math.min(
      sourcePreviewInteraction.top + event.clientY - sourcePreviewInteraction.startY,
      gridRect.height - cardRect.height
    )
  );
  sourcePreviewCard.style.setProperty('--pip-left', `${Math.round(left)}px`);
  sourcePreviewCard.style.setProperty('--pip-top', `${Math.round(top)}px`);
});

sourcePreviewResize.addEventListener('pointerdown', (event) => {
  if (previewGrid.classList.contains('split-comparison') || event.button !== 0) return;
  const { gridRect, cardRect } = sourcePreviewMetrics();
  const stage = sourcePreviewCard.querySelector('.preview-stage').getBoundingClientRect();
  sourcePreviewInteraction = {
    type: 'resize',
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    width: cardRect.width,
    stageHeight: stage.height,
    maxWidth: gridRect.right - cardRect.left,
    maxHeight: gridRect.bottom - stage.top
  };
  sourcePreviewResize.setPointerCapture(event.pointerId);
  sourcePreviewCard.classList.add('resizing');
  event.preventDefault();
  event.stopPropagation();
});

sourcePreviewResize.addEventListener('pointermove', (event) => {
  if (sourcePreviewInteraction?.type !== 'resize'
    || sourcePreviewInteraction.pointerId !== event.pointerId) return;
  const width = Math.max(
    140,
    Math.min(
      sourcePreviewInteraction.width + event.clientX - sourcePreviewInteraction.startX,
      sourcePreviewInteraction.maxWidth
    )
  );
  const stageHeight = Math.max(
    105,
    Math.min(
      sourcePreviewInteraction.stageHeight + event.clientY - sourcePreviewInteraction.startY,
      sourcePreviewInteraction.maxHeight
    )
  );
  const styles = getComputedStyle(sourcePreviewCard);
  const left = Number.parseFloat(styles.getPropertyValue('--pip-left')) || 0;
  const top = Number.parseFloat(styles.getPropertyValue('--pip-top')) || 0;
  setSourcePreviewGeometry(left, top, width, stageHeight);
});

function finishSourcePreviewInteraction(event) {
  if (!sourcePreviewInteraction || sourcePreviewInteraction.pointerId !== event.pointerId) return;
  sourcePreviewCard.classList.remove('moving', 'resizing');
  sourcePreviewInteraction = undefined;
  constrainSourcePreview();
}

sourcePreviewCaption.addEventListener('pointerup', finishSourcePreviewInteraction);
sourcePreviewCaption.addEventListener('pointercancel', finishSourcePreviewInteraction);
sourcePreviewResize.addEventListener('pointerup', finishSourcePreviewInteraction);
sourcePreviewResize.addEventListener('pointercancel', finishSourcePreviewInteraction);
window.addEventListener('resize', constrainSourcePreview);

function selectFile(selected) {
  if (!selected) return;
  pendingLayerConfiguration = undefined;
  vectorZoomTool = undefined;
  updateVectorZoomTool();
  setVectorPreviewZoom(1);
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
  status.textContent = 'Preparing vector preview…';
  status.classList.remove('error');
  scheduleAutomaticPreview(0);
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
  captureLayerConfiguration();
  clearVectorResult();
  scheduleAutomaticPreview();
});

const sliders = [threshold, colorCount, maximumTraceSide, curveSmoothing];

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
    captureLayerConfiguration();
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
  if (activePointerSlider) {
    const slider = activePointerSlider;
    activePointerSlider = undefined;
    commitSliderUpdate(slider);
  }
  if (activeLayerStrokePointer) {
    activeLayerStrokePointer = false;
    commitSelectedLayerStroke();
  }
});

window.addEventListener('pointercancel', () => {
  activePointerSlider = undefined;
  activeLayerStrokePointer = false;
  layerStrokePending = false;
  renderLayerPreview();
});

for (const input of [
  vectorMode,
  svgStructure,
  removeBackground,
  keepWhiteLayer,
  fillColorGaps
]) {
  input.addEventListener('change', () => {
    updateOutputs();
    saveSettings();
    captureLayerConfiguration();
    clearVectorResult();
    scheduleAutomaticPreview(0);
  });
}

async function generatePreview() {
  if (!file) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = undefined;
  captureLayerConfiguration();
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
    form.append('fillColorGaps', String(fillColorGaps.checked));
    form.append('maximumTraceSide', maximumTraceSide.value);
    form.append('curveSmoothing', curveSmoothing.value);
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
    const restoredLayers = restoreLayerConfiguration(palette);
    palette = restoredLayers.palette;
    refreshDownloadUrl();
    showPalette(palette);
    restoreLayerPanelState(restoredLayers.configuration);
    renderLayerPreview();
    vectorPreview.hidden = false;
    vectorPlaceholder.hidden = true;
    downloadButton.disabled = false;
    status.textContent = restoredLayers.restored
      ? 'Vector preview ready. Layer settings preserved.'
      : 'Vector preview ready.';
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
