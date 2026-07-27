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
const multipleVariations = document.getElementById('multipleVariations');
const variationSettings = document.getElementById('variationSettings');
const variationChips = document.getElementById('variationChips');
const addVariation = document.getElementById('addVariation');
const variationResults = document.getElementById('variationResults');
const variationGallery = document.getElementById('variationGallery');
const removeBackground = document.getElementById('removeBackground');
const keepWhiteLayer = document.getElementById('keepWhiteLayer');
const fillColorGaps = document.getElementById('fillColorGaps');
const palettePanel = document.getElementById('palettePanel');
const paletteSwatches = document.getElementById('paletteSwatches');
const showAllLayers = document.getElementById('showAllLayers');
const hideAllLayers = document.getElementById('hideAllLayers');
const undoLayerEdit = document.getElementById('undoLayerEdit');
const redoLayerEdit = document.getElementById('redoLayerEdit');
const duplicateSelectedLayers = document.getElementById('duplicateSelectedLayers');
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
const vectorEraserTool = document.getElementById('vectorEraserTool');
const vectorLassoTool = document.getElementById('vectorLassoTool');
const fillSelectedLayers = document.getElementById('fillSelectedLayers');
const layerFillColor = document.getElementById('layerFillColor');
const eraserSize = document.getElementById('eraserSize');
const eraserSizeValue = document.getElementById('eraserSizeValue');
const vectorZoomOut = document.getElementById('vectorZoomOut');
const vectorZoomIn = document.getElementById('vectorZoomIn');
const vectorZoomValue = document.getElementById('vectorZoomValue');
const maximumTraceSide = document.getElementById('maximumTraceSide');
const allowTraceUpscaling = document.getElementById('allowTraceUpscaling');
const resolutionValue = document.getElementById('resolutionValue');
const curveSmoothing = document.getElementById('curveSmoothing');
const curveSmoothingValue = document.getElementById('curveSmoothingValue');
const previewButton = document.getElementById('previewButton');
const downloadButton = document.getElementById('downloadButton');
const downloadPdfButton = document.getElementById('downloadPdfButton');
const status = document.getElementById('status');
const placeholder = document.getElementById('placeholder');
const previewImage = document.getElementById('previewImage');
const vectorPlaceholder = document.getElementById('vectorPlaceholder');
const vectorPreview = document.getElementById('vectorPreview');
const vectorStage = vectorPreview.closest('.vector-stage');
const eraserCursor = document.getElementById('eraserCursor');
const processingModal = document.getElementById('processingModal');
const processingText = document.getElementById('processingText');
const processingPercent = document.getElementById('processingPercent');
const processingProgress = document.getElementById('processingProgress');
const SETTINGS_KEY = 'ronyka-vectorizer.settings.v1';
const INKSCAPE_NAMESPACE = 'http://www.inkscape.org/namespaces/inkscape';
const LAYER_HISTORY_LIMIT = 40;
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
let eraserToolActive = false;
let activeEraserStroke;
let lassoToolActive = false;
let activeLassoStroke;
let bucketToolActive = false;
let lastVectorPointer;
let draggedCanvasPan;
let lastEraserPointer;
let layerUndoHistory = [];
let layerRedoHistory = [];
let paletteVariationCounts = [4, 8, 12];
let paletteVariationResults = new Map();
let activeVariationCount;
const pendingSliderUpdates = new WeakSet();

function cloneHistoryStates(states) {
  return states.map((state) => ({
    svgText: state.svgText,
    palette: state.palette.map((entry) => ({ ...entry })),
    layers: state.layers.map((layer) => ({ ...layer }))
  }));
}

function saveActiveVariation() {
  const result = paletteVariationResults.get(activeVariationCount);
  const state = layerHistoryState();
  if (!result || !state) return;
  result.svgText = state.svgText;
  result.palette = state.palette;
  result.layers = state.layers;
  result.undoHistory = cloneHistoryStates(layerUndoHistory);
  result.redoHistory = cloneHistoryStates(layerRedoHistory);
}

function svgTextForDownload(svgText, forceCorelCompatibility = false) {
  if (!forceCorelCompatibility && svgStructure.value !== 'corel') return svgText;
  const documentNode = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return svgText;
  const inheritedAttributes = [
    'mask',
    'clip-path',
    'opacity',
    'filter',
    'fill',
    'fill-opacity',
    'fill-rule',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit'
  ];
  const groups = [...documentNode.querySelectorAll('g')]
    .filter((group) => !group.closest('defs'))
    .reverse();
  for (const group of groups) {
    const children = [...group.children].filter(
      (child) => child.localName !== 'title'
    );
    for (const child of children) {
      const groupTransform = group.getAttribute('transform');
      const childTransform = child.getAttribute('transform');
      if (groupTransform) {
        child.setAttribute(
          'transform',
          childTransform ? `${groupTransform} ${childTransform}` : groupTransform
        );
      }
      const groupStyle = group.getAttribute('style');
      if (groupStyle) {
        const childStyle = child.getAttribute('style');
        child.setAttribute(
          'style',
          childStyle ? `${groupStyle};${childStyle}` : groupStyle
        );
      }
      for (const attribute of inheritedAttributes) {
        if (group.hasAttribute(attribute) && !child.hasAttribute(attribute)) {
          child.setAttribute(attribute, group.getAttribute(attribute));
        }
      }
      group.parentNode.insertBefore(child, group);
    }
    group.remove();
  }
  for (const element of documentNode.querySelectorAll('*')) {
    element.removeAttributeNS(INKSCAPE_NAMESPACE, 'groupmode');
    element.removeAttributeNS(INKSCAPE_NAMESPACE, 'label');
    element.removeAttribute('inkscape:groupmode');
    element.removeAttribute('inkscape:label');
    element.removeAttribute('sodipodi:insensitive');
    element.removeAttribute('data-layer-root');
    element.removeAttribute('data-layer-index');
    element.removeAttribute('data-name');
    element.removeAttribute('data-color');
  }
  documentNode.documentElement.removeAttribute('xmlns:inkscape');
  return `${new XMLSerializer().serializeToString(documentNode)}\n`;
}

function downloadSvgText(svgText, filename) {
  const url = URL.createObjectURL(
    new Blob([svgTextForDownload(svgText)], { type: 'image/svg+xml' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadVariation(result) {
  downloadSvgText(
    result.svgText,
    `original-vectorized-${result.count}-colors.svg`
  );
}

function referencedSvgIds(root) {
  const references = new Set();
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of element.attributes) {
      for (const match of attribute.value.matchAll(/url\(#([^)]+)\)|^#(.+)$/g)) {
        references.add(match[1] || match[2]);
      }
    }
  }
  return references;
}

function rewriteSvgReferences(root, idMap) {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.id && idMap.has(element.id)) {
      element.id = idMap.get(element.id);
    }
    for (const attribute of [...element.attributes]) {
      let value = attribute.value;
      for (const [sourceId, targetId] of idMap) {
        value = value.replaceAll(`url(#${sourceId})`, `url(#${targetId})`);
        if (value === `#${sourceId}`) value = `#${targetId}`;
      }
      if (value !== attribute.value) element.setAttribute(attribute.name, value);
    }
  }
}

function importSelectedLayersIntoVariation(targetCount) {
  const sourceCount = activeVariationCount;
  const targetResult = paletteVariationResults.get(targetCount);
  const selectedLayers = selectedLayerNumbers();
  if (sourceCount === undefined || !targetResult) return;
  if (selectedLayers.length === 0) {
    status.classList.add('error');
    status.textContent = 'Select at least one layer to import into another variation.';
    return;
  }
  saveActiveVariation();
  const sourceResult = paletteVariationResults.get(sourceCount);
  const sourceDocument = new DOMParser().parseFromString(
    sourceResult.svgText,
    'image/svg+xml'
  );
  const targetDocument = new DOMParser().parseFromString(
    targetResult.svgText,
    'image/svg+xml'
  );
  if (
    sourceDocument.querySelector('parsererror') ||
    targetDocument.querySelector('parsererror')
  ) return;

  targetResult.undoHistory ||= [];
  targetResult.undoHistory.push({
    svgText: targetResult.svgText,
    palette: targetResult.palette.map((entry) => ({ ...entry })),
    layers: (targetResult.layers || []).map((layer) => ({ ...layer }))
  });
  if (targetResult.undoHistory.length > LAYER_HISTORY_LIMIT) {
    targetResult.undoHistory.shift();
  }
  targetResult.redoHistory = [];

  const targetSvg = targetDocument.documentElement;
  let targetDefs = targetSvg.querySelector(':scope > defs');
  if (!targetDefs) {
    targetDefs = targetDocument.createElementNS('http://www.w3.org/2000/svg', 'defs');
    targetSvg.prepend(targetDefs);
  }
  let nextLayerNumber = Math.max(
    0,
    ...targetResult.palette.map((entry) => Number(entry.layer) || 0)
  ) + 1;
  const importedEntries = [];
  const importedStates = [];

  for (const sourceLayerNumber of selectedLayers) {
    const sourceRoot = sourceDocument.querySelector(
      `[data-layer-root="${sourceLayerNumber}"]`
    );
    const sourceEntry = sourceResult.palette.find(
      (entry) => Number(entry.layer) === sourceLayerNumber
    );
    if (!sourceRoot || !sourceEntry) continue;
    const newLayerNumber = nextLayerNumber++;
    const newName =
      `${sourceEntry.name || `Layer ${sourceLayerNumber}`} · ${sourceCount} colors`;
    const importedRoot = targetDocument.importNode(sourceRoot, true);
    const dependencyRoots = [];
    const queuedIds = [...referencedSvgIds(importedRoot)];
    const copiedIds = new Set();
    while (queuedIds.length > 0) {
      const referencedId = queuedIds.shift();
      if (copiedIds.has(referencedId)) continue;
      copiedIds.add(referencedId);
      const dependency = sourceDocument.getElementById(referencedId);
      if (!dependency || sourceRoot.contains(dependency)) continue;
      const importedDependency = targetDocument.importNode(dependency, true);
      dependencyRoots.push(importedDependency);
      for (const nestedId of referencedSvgIds(importedDependency)) {
        if (!copiedIds.has(nestedId)) queuedIds.push(nestedId);
      }
    }

    const idMap = new Map();
    for (const element of [
      importedRoot,
      ...importedRoot.querySelectorAll('[id]'),
      ...dependencyRoots.flatMap((root) => [root, ...root.querySelectorAll('[id]')])
    ]) {
      if (!element.id || idMap.has(element.id)) continue;
      idMap.set(element.id, `${element.id}-import-${targetCount}-${newLayerNumber}`);
    }
    rewriteSvgReferences(importedRoot, idMap);
    for (const dependency of dependencyRoots) {
      rewriteSvgReferences(dependency, idMap);
      targetDefs.append(dependency);
    }

    importedRoot.dataset.layerRoot = String(newLayerNumber);
    importedRoot.dataset.layerIndex = String(newLayerNumber);
    importedRoot.dataset.name = newName;
    targetSvg.append(importedRoot);
    renameLayerInDocument(targetDocument, newLayerNumber, newName);
    importedEntries.push({
      ...sourceEntry,
      layer: newLayerNumber,
      name: newName
    });
    const sourceIndex = sourceResult.palette.findIndex(
      (entry) => Number(entry.layer) === sourceLayerNumber
    );
    importedStates.push({
      ...(sourceResult.layers?.[sourceIndex] || {}),
      selected: true
    });
  }

  if (importedEntries.length === 0) {
    targetResult.undoHistory.pop();
    return;
  }
  targetResult.svgText =
    `${new XMLSerializer().serializeToString(targetDocument)}\n`;
  targetResult.palette = [...targetResult.palette, ...importedEntries];
  targetResult.layers = [
    ...(targetResult.layers || targetResult.palette
      .slice(0, -importedEntries.length)
      .map(() => ({ visible: true, selected: false }))),
    ...importedStates
  ];
  renderVariationGallery();
  status.classList.remove('error');
  status.textContent =
    `Imported ${importedEntries.length} selected layer${importedEntries.length === 1 ? '' : 's'} from ${sourceCount} colors into ${targetCount} colors.`;
}

function renderVariationGallery() {
  variationGallery.replaceChildren();
  const visible = paletteVariationResults.size > 0;
  variationResults.hidden = !visible;
  if (!visible) return;
  for (const result of paletteVariationResults.values()) {
    const card = document.createElement('article');
    card.className = 'variation-card';
    card.classList.toggle('active', result.count === activeVariationCount);
    card.tabIndex = 0;
    card.dataset.variationCount = String(result.count);
    card.setAttribute('aria-label', `${result.count} color palette variation`);

    const thumbnail = document.createElement('div');
    thumbnail.className = 'variation-thumbnail';
    thumbnail.innerHTML = result.svgText;
    thumbnail.querySelector('svg')?.removeAttribute('width');
    thumbnail.querySelector('svg')?.removeAttribute('height');

    const footer = document.createElement('div');
    footer.className = 'variation-card-footer';
    const label = document.createElement('strong');
    label.textContent = `${result.count} colors`;
    const actions = document.createElement('span');
    actions.className = 'variation-card-actions';
    if (result.count !== activeVariationCount) {
      const importLayers = document.createElement('button');
      importLayers.type = 'button';
      importLayers.textContent = '⇥';
      importLayers.title = `Import selected layers into ${result.count} colors`;
      importLayers.setAttribute('aria-label', importLayers.title);
      importLayers.addEventListener('click', (event) => {
        event.stopPropagation();
        importSelectedLayersIntoVariation(result.count);
      });
      actions.append(importLayers);
    }
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = '↓';
    download.title = `Download ${result.count}-color SVG`;
    download.setAttribute('aria-label', download.title);
    download.addEventListener('click', (event) => {
      event.stopPropagation();
      if (result.count === activeVariationCount) saveActiveVariation();
      downloadVariation(result);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = `Delete ${result.count}-color variation`;
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteVariation(result.count);
    });
    actions.append(download, remove);
    footer.append(label, actions);
    card.append(thumbnail, footer);
    card.addEventListener('click', () => activateVariation(result.count));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateVariation(result.count);
      }
    });
    variationGallery.append(card);
  }
}

function activateVariation(count) {
  if (count === activeVariationCount) return;
  const result = paletteVariationResults.get(count);
  if (!result) return;
  saveActiveVariation();
  activeVariationCount = count;
  vectorSvgText = result.svgText;
  currentPalette = result.palette.map((entry) => ({ ...entry }));
  refreshDownloadUrl();
  showPalette(currentPalette);
  restoreLayerPanelState(result.layers || currentPalette.map(() => ({
    visible: true,
    selected: false
  })));
  layerUndoHistory = cloneHistoryStates(result.undoHistory || []);
  layerRedoHistory = cloneHistoryStates(result.redoHistory || []);
  updateLayerHistoryControls();
  renderLayerPreview();
  vectorPreview.hidden = false;
  vectorPlaceholder.hidden = true;
  downloadButton.disabled = false;
  downloadPdfButton.disabled = false;
  renderVariationGallery();
  status.classList.remove('error');
  status.textContent = `${count}-color variation selected.`;
}

function deleteVariation(count) {
  const deletingActive = count === activeVariationCount;
  paletteVariationResults.delete(count);
  if (deletingActive) {
    activeVariationCount = undefined;
    const next = paletteVariationResults.keys().next().value;
    if (next !== undefined) {
      activateVariation(next);
      return;
    }
    clearVectorResult();
  }
  renderVariationGallery();
}

function clearVariationResults() {
  paletteVariationResults.clear();
  activeVariationCount = undefined;
  variationGallery.replaceChildren();
  variationResults.hidden = true;
}

function renderVariationChips() {
  variationChips.replaceChildren();
  for (const count of paletteVariationCounts) {
    const chip = document.createElement('span');
    chip.className = 'variation-chip';
    chip.append(`${count} colors`);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${count}-color variation`);
    remove.disabled = paletteVariationCounts.length === 1;
    remove.addEventListener('click', () => {
      paletteVariationCounts = paletteVariationCounts.filter(
        (variationCount) => variationCount !== count
      );
      renderVariationChips();
      saveSettings();
      clearVectorResult();
    });
    chip.append(remove);
    variationChips.append(chip);
  }
  previewButton.textContent =
    vectorMode.value === 'multicolor' && multipleVariations.checked
    ? `Generate ${paletteVariationCounts.length} variations`
    : 'Preview vector';
}

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
  if (layerUndoHistory.length > LAYER_HISTORY_LIMIT) layerUndoHistory.shift();
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
    if (layerRedoHistory.length > LAYER_HISTORY_LIMIT) layerRedoHistory.shift();
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
    if (layerUndoHistory.length > LAYER_HISTORY_LIMIT) layerUndoHistory.shift();
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

function cancelVectorization() {
  if (!previewController) return false;
  resultRevision += 1;
  previewController.abort();
  previewController = undefined;
  hideProcessing();
  previewButton.disabled = false;
  downloadButton.disabled = true;
  downloadPdfButton.disabled = true;
  status.classList.remove('error');
  status.textContent = 'Vectorization canceled.';
  return true;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    targetHeightMm: Number(targetHeight.value),
    mode: vectorMode.value,
    svgStructure: svgStructure.value,
    threshold: Number(threshold.value),
    colorCount: Number(colorCount.value),
    multipleVariations: multipleVariations.checked,
    paletteVariationCounts,
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
    if (['groups', 'corel', 'flat'].includes(settings.svgStructure)) {
      svgStructure.value = settings.svgStructure;
    }
    if (Number(settings.threshold) >= 1 && Number(settings.threshold) <= 254) {
      threshold.value = String(settings.threshold);
    }
    if (Number(settings.maximumTraceSide) >= 500 && Number(settings.maximumTraceSide) <= 20000) {
      maximumTraceSide.value = String(settings.maximumTraceSide);
    }
    if (Number(settings.curveSmoothing) >= 0 && Number(settings.curveSmoothing) <= 100) {
      curveSmoothing.value = String(settings.curveSmoothing);
    }
    if (Number(settings.colorCount) >= 2 && Number(settings.colorCount) <= 33) {
      colorCount.value = String(settings.colorCount);
    }
    if (typeof settings.multipleVariations === 'boolean') {
      multipleVariations.checked = settings.multipleVariations;
    }
    if (Array.isArray(settings.paletteVariationCounts)) {
      const counts = [...new Set(settings.paletteVariationCounts
        .map(Number)
        .filter((count) => Number.isInteger(count) && count >= 2 && count <= 33))]
        .sort((left, right) => left - right);
      if (counts.length > 0) paletteVariationCounts = counts;
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
  variationSettings.hidden = !multicolor || !multipleVariations.checked;
  renderVariationChips();
}

function clearVectorResult() {
  resultRevision += 1;
  clearVariationResults();
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
  duplicateSelectedLayers.disabled = true;
  fillSelectedLayers.disabled = true;
  layerFillColor.disabled = true;
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
  downloadPdfButton.disabled = true;
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

function saveLayerPositions(positions) {
  if (!vectorSvgText) return;
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  for (const { layerNumber, translateX, translateY } of positions) {
    const layer = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
    if (!layer) continue;
    layer.dataset.translateX = String(translateX);
    layer.dataset.translateY = String(translateY);
    layer.setAttribute('transform', `translate(${translateX} ${translateY})`);
  }
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

function selectLayerFromPreview(layerNumber, additive) {
  const target = paletteSwatches.querySelector(
    `.layer-selection[data-layer="${layerNumber}"]`
  );
  if (!target) return;
  if (!additive) {
    for (const selection of paletteSwatches.querySelectorAll('.layer-selection')) {
      selection.checked = false;
      selection.closest('.palette-swatch')?.classList.remove('merge-selected');
    }
    target.checked = true;
  } else {
    target.checked = !target.checked;
  }
  target.closest('.palette-swatch')?.classList.toggle(
    'merge-selected',
    target.checked
  );
  updateLayerSelectionControls();
  status.classList.remove('error');
  status.textContent = target.checked
    ? `Selected layer ${layerNumber}.`
    : `Deselected layer ${layerNumber}.`;
}

function deleteSelectedLayerEntries() {
  const selectedLayers = selectedLayerNumbers();
  if (selectedLayers.length === 0 || !vectorSvgText) return;
  const selectedSet = new Set(selectedLayers);
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const roots = [...documentNode.querySelectorAll('[data-layer-root]')]
    .filter((root) => selectedSet.has(Number(root.dataset.layerRoot)));
  if (roots.length === 0) return;
  const visibilityByLayer = new Map(
    [...paletteSwatches.querySelectorAll('.palette-swatch')].map((row) => [
      Number(row.dataset.layer),
      row.querySelector('.layer-visibility')?.getAttribute('aria-pressed') !== 'false'
    ])
  );
  pushLayerHistory();
  const possibleMaskIds = [];
  for (const root of roots) {
    const maskId = root.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
    if (maskId) possibleMaskIds.push(maskId);
    root.remove();
  }
  for (const maskId of possibleMaskIds) {
    if (!documentNode.querySelector(`[mask="url(#${CSS.escape(maskId)})"]`)) {
      documentNode.getElementById(maskId)?.remove();
    }
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  const remainingPalette = currentPalette.filter(
    (entry) => !selectedSet.has(Number(entry.layer))
  );
  showPalette(remainingPalette);
  restoreLayerPanelState(remainingPalette.map((entry) => ({
    visible: visibilityByLayer.get(Number(entry.layer)) !== false,
    selected: false
  })));
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent =
    `Deleted ${selectedLayers.length} layer${selectedLayers.length === 1 ? '' : 's'}.`;
}

function updateLayerSelectionControls() {
  const selectedLayers = selectedLayerNumbers();
  duplicateSelectedLayers.disabled = selectedLayers.length === 0;
  mergeSelectedLayers.disabled = selectedLayers.length < 2;
  layerStrokeWidth.disabled = selectedLayers.length === 0;
  fillSelectedLayers.disabled = !vectorSvgText;
  layerFillColor.disabled = !vectorSvgText;
  if (selectedLayers.length === 0) {
    layerStrokeWidth.value = '0';
    layerStrokeValue.value = '0 px';
    return;
  }
  const selectedRoot = vectorPreview.querySelector(
    `[data-layer-root="${selectedLayers[0]}"]`
  );
  const selectedEntry = currentPalette.find(
    (entry) => Number(entry.layer) === selectedLayers[0]
  );
  if (/^#[0-9a-f]{6}$/i.test(selectedEntry?.color || '')) {
    layerFillColor.value = selectedEntry.color;
  }
  const width = Number(selectedRoot?.dataset.fillStrokeWidth || 0);
  layerStrokeWidth.value = String(width);
  layerStrokeValue.value = `${width} px`;
}

function applySelectedLayerFill(selectedLayers = selectedLayerNumbers()) {
  if (selectedLayers.length === 0 || !vectorSvgText) return;
  const selectedSet = new Set(selectedLayers);
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const color = layerFillColor.value.toUpperCase();
  const panelState = currentPalette.map((entry) => {
    const row = paletteSwatches.querySelector(
      `.palette-swatch[data-layer="${entry.layer}"]`
    );
    return {
      visible:
        row?.querySelector('.layer-visibility')?.getAttribute('aria-pressed') !== 'false',
      selected: selectedSet.has(Number(entry.layer))
    };
  });
  pushLayerHistory();
  for (const layerNumber of selectedLayers) {
    const root = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
    if (!root) continue;
    const paths = root.localName === 'path'
      ? [root]
      : [...root.querySelectorAll('path')];
    for (const path of paths) {
      const previousFill = path.getAttribute('fill');
      const previousStroke = path.getAttribute('stroke');
      path.setAttribute('fill', color);
      if (
        previousStroke &&
        (
          previousStroke.toLowerCase() === previousFill?.toLowerCase() ||
          root.hasAttribute('data-fill-stroke-width')
        )
      ) {
        path.setAttribute('stroke', color);
      }
    }
    root.dataset.color = color;
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  showPalette(currentPalette.map((entry) => (
    selectedSet.has(Number(entry.layer))
      ? { ...entry, color }
      : { ...entry }
  )));
  restoreLayerPanelState(panelState);
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent =
    `Filled ${selectedLayers.length} selected layer${selectedLayers.length === 1 ? '' : 's'} with ${color}.`;
}

function duplicateSelectedLayerEntries() {
  const selectedLayers = selectedLayerNumbers();
  if (selectedLayers.length === 0 || !vectorSvgText) return;
  const selectedSet = new Set(selectedLayers);
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const sourceRoots = new Map(
    [...documentNode.querySelectorAll('[data-layer-root]')]
      .filter((root) => selectedSet.has(Number(root.dataset.layerRoot)))
      .map((root) => [Number(root.dataset.layerRoot), root])
  );
  if (sourceRoots.size === 0) return;
  const visibilityByLayer = new Map(
    [...paletteSwatches.querySelectorAll('.palette-swatch')].map((row) => [
      Number(row.dataset.layer),
      row.querySelector('.layer-visibility')?.getAttribute('aria-pressed') !== 'false'
    ])
  );
  pushLayerHistory();
  let nextLayerNumber = Math.max(
    0,
    ...currentPalette.map((entry) => Number(entry.layer) || 0)
  ) + 1;
  const duplicatedPalette = [];
  const duplicateSourceByLayer = new Map();
  for (const entry of currentPalette) {
    duplicatedPalette.push({ ...entry });
    const sourceLayerNumber = Number(entry.layer);
    const sourceRoot = sourceRoots.get(sourceLayerNumber);
    if (!sourceRoot) continue;
    const duplicateLayerNumber = nextLayerNumber++;
    const duplicateName = `${entry.name || `Layer ${sourceLayerNumber}`} copy`;
    const clone = sourceRoot.cloneNode(true);
    clone.dataset.layerRoot = String(duplicateLayerNumber);
    clone.dataset.name = duplicateName;
    const idSuffix = `-copy-${duplicateLayerNumber}`;
    for (const element of [clone, ...clone.querySelectorAll('[id]')]) {
      if (element.id) element.id = `${element.id}${idSuffix}`;
    }
    const sourceMaskId = sourceRoot.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
    const sourceMask = sourceMaskId
      ? documentNode.getElementById(sourceMaskId)
      : undefined;
    if (sourceMask) {
      const duplicateMaskId = `eraser-mask-layer-${duplicateLayerNumber}`;
      const duplicateMask = sourceMask.cloneNode(true);
      duplicateMask.id = duplicateMaskId;
      let defs = documentNode.documentElement.querySelector(':scope > defs');
      if (!defs) {
        defs = documentNode.createElementNS('http://www.w3.org/2000/svg', 'defs');
        documentNode.documentElement.prepend(defs);
      }
      defs.append(duplicateMask);
      clone.setAttribute('mask', `url(#${duplicateMaskId})`);
    }
    sourceRoot.parentNode.insertBefore(clone, sourceRoot.nextSibling);
    renameLayerInDocument(documentNode, duplicateLayerNumber, duplicateName);
    duplicatedPalette.push({
      ...entry,
      layer: duplicateLayerNumber,
      name: duplicateName
    });
    duplicateSourceByLayer.set(duplicateLayerNumber, sourceLayerNumber);
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  showPalette(duplicatedPalette);
  restoreLayerPanelState(duplicatedPalette.map((entry) => {
    const layerNumber = Number(entry.layer);
    const sourceLayer = duplicateSourceByLayer.get(layerNumber);
    return {
      visible: visibilityByLayer.get(sourceLayer ?? layerNumber) !== false,
      selected: sourceLayer !== undefined
    };
  }));
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent =
    `Duplicated ${selectedLayers.length} layer${selectedLayers.length === 1 ? '' : 's'}.`;
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

function ensureLayerEraserMask(documentNode, root, layerNumber) {
  const svg = root.ownerSVGElement || documentNode.documentElement;
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = documentNode.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.prepend(defs);
  }
  const maskId = `eraser-mask-layer-${layerNumber}`;
  let mask = documentNode.getElementById(maskId);
  if (!mask) {
    const existingId = root.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
    const existing = existingId ? documentNode.getElementById(existingId) : undefined;
    mask = existing
      ? existing.cloneNode(true)
      : documentNode.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.id = maskId;
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    if (!existing) {
      const viewBox = (svg.getAttribute('viewBox') || '0 0 1 1')
        .trim()
        .split(/\s+/)
        .map(Number);
      const [x, y, width, height] = viewBox;
      mask.setAttribute('x', String(x));
      mask.setAttribute('y', String(y));
      mask.setAttribute('width', String(width));
      mask.setAttribute('height', String(height));
      const background = documentNode.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      );
      background.setAttribute('x', String(x));
      background.setAttribute('y', String(y));
      background.setAttribute('width', String(width));
      background.setAttribute('height', String(height));
      background.setAttribute('fill', 'white');
      mask.append(background);
    }
    defs.append(mask);
  }
  root.setAttribute('mask', `url(#${maskId})`);
  return mask;
}

function appendEraserPoint(documentNode, layerNumber, point, radius) {
  const root = documentNode.querySelector(`[data-layer-root="${layerNumber}"]`);
  if (!root) return;
  const mask = ensureLayerEraserMask(documentNode, root, layerNumber);
  const circle = documentNode.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', String(point.x));
  circle.setAttribute('cy', String(point.y));
  circle.setAttribute('r', String(radius));
  circle.setAttribute('fill', 'black');
  mask.append(circle);
}

function addEraserStrokePoint(event) {
  if (!activeEraserStroke) return;
  for (const layer of activeEraserStroke.layers) {
    const matrix = layer.root.getScreenCTM();
    if (!matrix) continue;
    const point = new DOMPoint(event.clientX, event.clientY)
      .matrixTransform(matrix.inverse());
    const previous = layer.points.at(-1);
    if (
      previous &&
      Math.hypot(point.x - previous.x, point.y - previous.y)
        < activeEraserStroke.radius / 3
    ) continue;
    const nextPoint = { x: point.x, y: point.y };
    layer.points.push(nextPoint);
    appendEraserPoint(
      layer.root.ownerDocument,
      layer.layerNumber,
      nextPoint,
      activeEraserStroke.radius
    );
  }
}

function updateEraserCursor(event = lastEraserPointer) {
  if (!eraserToolActive || !event || vectorPreview.hidden) {
    eraserCursor.hidden = true;
    return;
  }
  lastEraserPointer = { clientX: event.clientX, clientY: event.clientY };
  const selectedLayer = vectorPreview.querySelector(
    `[data-layer-root="${selectedLayerNumbers()[0]}"]`
  );
  const scaleTarget = selectedLayer || vectorPreview.querySelector('svg');
  const matrix = scaleTarget?.getScreenCTM();
  if (!matrix) {
    eraserCursor.hidden = true;
    return;
  }
  const scale = (
    Math.hypot(matrix.a, matrix.b) +
    Math.hypot(matrix.c, matrix.d)
  ) / 2;
  const diameter = Math.max(4, Number(eraserSize.value) * scale);
  const stageBounds = eraserCursor.parentElement.getBoundingClientRect();
  eraserCursor.style.width = `${diameter}px`;
  eraserCursor.style.height = `${diameter}px`;
  eraserCursor.style.left =
    `${event.clientX - stageBounds.left + vectorStage.scrollLeft}px`;
  eraserCursor.style.top =
    `${event.clientY - stageBounds.top + vectorStage.scrollTop}px`;
  eraserCursor.hidden = false;
}

vectorStage.addEventListener('scroll', () => {
  if (eraserToolActive && lastEraserPointer) updateEraserCursor();
});

function commitEraserStroke() {
  if (!activeEraserStroke || !vectorSvgText) return;
  const stroke = activeEraserStroke;
  activeEraserStroke = undefined;
  if (!stroke.layers.some((layer) => layer.points.length > 0)) {
    renderLayerPreview();
    return;
  }
  pushLayerHistory();
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  for (const layer of stroke.layers) {
    for (const point of layer.points) {
      appendEraserPoint(
        documentNode,
        layer.layerNumber,
        point,
        stroke.radius
      );
    }
  }
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent =
    `Erased artwork from ${stroke.layers.length} selected layer${stroke.layers.length === 1 ? '' : 's'}.`;
}

function addLassoPoint(event) {
  if (!activeLassoStroke) return;
  const matrix = activeLassoStroke.root.getScreenCTM();
  if (!matrix) return;
  const point = new DOMPoint(event.clientX, event.clientY)
    .matrixTransform(matrix.inverse());
  const previous = activeLassoStroke.points.at(-1);
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 3) return;
  activeLassoStroke.points.push({ x: point.x, y: point.y });
  activeLassoStroke.preview.setAttribute(
    'points',
    activeLassoStroke.points.map(({ x, y }) => `${x},${y}`).join(' ')
  );
}

function commitLassoLayer() {
  if (!activeLassoStroke || !vectorSvgText) return;
  const stroke = activeLassoStroke;
  activeLassoStroke = undefined;
  stroke.preview.remove();
  if (stroke.points.length < 3) {
    renderLayerPreview();
    status.classList.add('error');
    status.textContent = 'Draw a larger closed lasso region.';
    return;
  }
  const documentNode = new DOMParser().parseFromString(vectorSvgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return;
  const sourceRoot = documentNode.querySelector(
    `[data-layer-root="${stroke.layerNumber}"]`
  );
  const sourceEntry = currentPalette.find(
    (entry) => Number(entry.layer) === stroke.layerNumber
  );
  if (!sourceRoot || !sourceEntry) return;
  const visibilityByLayer = new Map(
    [...paletteSwatches.querySelectorAll('.palette-swatch')].map((row) => [
      Number(row.dataset.layer),
      row.querySelector('.layer-visibility')?.getAttribute('aria-pressed') !== 'false'
    ])
  );
  pushLayerHistory();
  const svg = documentNode.documentElement;
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = documentNode.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.prepend(defs);
  }
  const newLayerNumber = Math.max(
    0,
    ...currentPalette.map((entry) => Number(entry.layer) || 0)
  ) + 1;
  const newName = `${sourceEntry.name || `Layer ${stroke.layerNumber}`} lasso`;
  const polygonPoints = stroke.points.map(({ x, y }) => `${x},${y}`).join(' ');

  const clone = sourceRoot.cloneNode(true);
  clone.dataset.layerRoot = String(newLayerNumber);
  clone.dataset.name = newName;
  const idSuffix = `-lasso-${newLayerNumber}`;
  for (const element of [clone, ...clone.querySelectorAll('[id]')]) {
    if (element.id) element.id = `${element.id}${idSuffix}`;
  }

  const sourceMaskId = sourceRoot.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
  const sourceMask = sourceMaskId ? documentNode.getElementById(sourceMaskId) : undefined;
  if (sourceMask) {
    const cloneMask = sourceMask.cloneNode(true);
    const cloneMaskId = `eraser-mask-layer-${newLayerNumber}`;
    cloneMask.id = cloneMaskId;
    defs.append(cloneMask);
    clone.setAttribute('mask', `url(#${cloneMaskId})`);
  }

  const clipId = `lasso-clip-layer-${newLayerNumber}`;
  const clip = documentNode.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clip.id = clipId;
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const insidePolygon = documentNode.createElementNS(
    'http://www.w3.org/2000/svg',
    'polygon'
  );
  insidePolygon.setAttribute('points', polygonPoints);
  const existingClip = clone.getAttribute('clip-path');
  if (existingClip) insidePolygon.setAttribute('clip-path', existingClip);
  clip.append(insidePolygon);
  defs.append(clip);
  clone.setAttribute('clip-path', `url(#${clipId})`);

  const sourceMaskRoot = ensureLayerEraserMask(
    documentNode,
    sourceRoot,
    stroke.layerNumber
  );
  const outsidePolygon = documentNode.createElementNS(
    'http://www.w3.org/2000/svg',
    'polygon'
  );
  outsidePolygon.setAttribute('points', polygonPoints);
  outsidePolygon.setAttribute('fill', 'black');
  sourceMaskRoot.append(outsidePolygon);

  sourceRoot.parentNode.insertBefore(clone, sourceRoot.nextSibling);
  renameLayerInDocument(documentNode, newLayerNumber, newName);
  vectorSvgText = `${new XMLSerializer().serializeToString(documentNode)}\n`;
  refreshDownloadUrl();

  const nextPalette = [];
  for (const entry of currentPalette) {
    nextPalette.push({ ...entry });
    if (Number(entry.layer) === stroke.layerNumber) {
      nextPalette.push({
        ...entry,
        layer: newLayerNumber,
        name: newName
      });
    }
  }
  showPalette(nextPalette);
  restoreLayerPanelState(nextPalette.map((entry) => ({
    visible: visibilityByLayer.get(
      Number(entry.layer) === newLayerNumber
        ? stroke.layerNumber
        : Number(entry.layer)
    ) !== false,
    selected: Number(entry.layer) === newLayerNumber
  })));
  renderLayerPreview();
  status.classList.remove('error');
  status.textContent = `Created ${newName} and removed it from the source layer.`;
}

vectorPreview.addEventListener('pointermove', (event) => {
  lastVectorPointer = { clientX: event.clientX, clientY: event.clientY };
  updateEraserCursor(event);
  if (draggedCanvasPan) {
    vectorStage.scrollLeft =
      draggedCanvasPan.scrollLeft - (event.clientX - draggedCanvasPan.startX);
    vectorStage.scrollTop =
      draggedCanvasPan.scrollTop - (event.clientY - draggedCanvasPan.startY);
    return;
  }
  if (activeLassoStroke) {
    addLassoPoint(event);
    return;
  }
  if (activeEraserStroke) {
    addEraserStrokePoint(event);
    return;
  }
  if (draggedPreviewLayer) {
    const point = previewPoint(draggedPreviewLayer.svg, event);
    if (!point) return;
    const deltaX = point.x - draggedPreviewLayer.startX;
    const deltaY = point.y - draggedPreviewLayer.startY;
    draggedPreviewLayer.moved =
      Math.hypot(
        event.clientX - draggedPreviewLayer.startClientX,
        event.clientY - draggedPreviewLayer.startClientY
      ) >= 4;
    for (const layer of draggedPreviewLayer.layers) {
      layer.translateX = layer.originalX + deltaX;
      layer.translateY = layer.originalY + deltaY;
      layer.element.setAttribute(
        'transform',
        `translate(${layer.translateX} ${layer.translateY})`
      );
      layer.element.dataset.translateX = String(layer.translateX);
      layer.element.dataset.translateY = String(layer.translateY);
    }
    return;
  }
  const layer = event.target.closest?.('[data-layer-root]');
  highlightLayerRow(layer?.dataset.layerRoot);
});

vectorPreview.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (bucketToolActive) {
    event.preventDefault();
    const layer = event.target.closest?.('[data-layer-root]');
    if (!layer) {
      status.classList.add('error');
      status.textContent = 'Click visible artwork to fill its layer.';
      return;
    }
    const layerNumber = Number(layer.dataset.layerRoot);
    applySelectedLayerFill([layerNumber]);
    return;
  }
  if (lassoToolActive) {
    const selectedLayers = selectedLayerNumbers();
    if (selectedLayers.length !== 1) {
      status.classList.add('error');
      status.textContent = 'Select exactly one layer before using the lasso.';
      return;
    }
    const svg = vectorPreview.querySelector('svg');
    const root = vectorPreview.querySelector(
      `[data-layer-root="${selectedLayers[0]}"]`
    );
    if (!svg || !root) return;
    event.preventDefault();
    const preview = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'polyline'
    );
    preview.classList.add('lasso-preview');
    preview.setAttribute('fill', '#ec168c');
    preview.setAttribute('fill-opacity', '0.12');
    preview.setAttribute('stroke', '#ec168c');
    preview.setAttribute('stroke-width', '3');
    preview.setAttribute('stroke-dasharray', '7 5');
    preview.setAttribute('pointer-events', 'none');
    const transform = root.getAttribute('transform');
    if (transform) preview.setAttribute('transform', transform);
    svg.append(preview);
    activeLassoStroke = {
      pointerId: event.pointerId,
      layerNumber: selectedLayers[0],
      root,
      points: [],
      preview
    };
    vectorPreview.setPointerCapture(event.pointerId);
    vectorPreview.classList.add('lassoing');
    addLassoPoint(event);
    return;
  }
  if (eraserToolActive) {
    const selectedLayers = selectedLayerNumbers();
    if (selectedLayers.length === 0) {
      status.classList.add('error');
      status.textContent = 'Select at least one layer before using the eraser.';
      return;
    }
    const layers = selectedLayers
      .map((layerNumber) => ({
        layerNumber,
        root: vectorPreview.querySelector(`[data-layer-root="${layerNumber}"]`),
        points: []
      }))
      .filter((layer) => layer.root);
    if (layers.length === 0) return;
    event.preventDefault();
    activeEraserStroke = {
      pointerId: event.pointerId,
      radius: Number(eraserSize.value) / 2,
      layers
    };
    vectorPreview.setPointerCapture(event.pointerId);
    vectorPreview.classList.add('erasing');
    addEraserStrokePoint(event);
    return;
  }
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
  if (!svg) return;
  if (!layer) {
    event.preventDefault();
    draggedCanvasPan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: vectorStage.scrollLeft,
      scrollTop: vectorStage.scrollTop
    };
    vectorPreview.setPointerCapture(event.pointerId);
    vectorStage.classList.add('panning-canvas');
    return;
  }
  const point = previewPoint(svg, event);
  if (!point) return;
  event.preventDefault();
  const layerNumber = layer.dataset.layerRoot;
  const selectedLayers = selectedLayerNumbers();
  const dragLayerNumbers = selectedLayers.includes(Number(layerNumber))
    ? selectedLayers
    : [Number(layerNumber)];
  const dragLayers = dragLayerNumbers
    .map((selectedLayerNumber) => {
      const element = vectorPreview.querySelector(
        `[data-layer-root="${selectedLayerNumber}"]`
      );
      if (!element) return;
      return {
        element,
        layerNumber: selectedLayerNumber,
        originalX: Number(element.dataset.translateX || 0),
        originalY: Number(element.dataset.translateY || 0),
        translateX: Number(element.dataset.translateX || 0),
        translateY: Number(element.dataset.translateY || 0)
      };
    })
    .filter(Boolean);
  draggedPreviewLayer = {
    svg,
    layerNumber,
    layers: dragLayers,
    startX: point.x,
    startY: point.y,
    startClientX: event.clientX,
    startClientY: event.clientY,
    additiveSelection: event.shiftKey,
    moved: false
  };
  vectorPreview.setPointerCapture(event.pointerId);
  vectorPreview.classList.add('dragging-layer');
  highlightLayerRow(layerNumber);
});

vectorPreview.addEventListener('pointerup', (event) => {
  if (draggedCanvasPan?.pointerId === event.pointerId) {
    draggedCanvasPan = undefined;
    if (vectorPreview.hasPointerCapture(event.pointerId)) {
      vectorPreview.releasePointerCapture(event.pointerId);
    }
    vectorStage.classList.remove('panning-canvas');
    return;
  }
  if (activeLassoStroke?.pointerId === event.pointerId) {
    if (vectorPreview.hasPointerCapture(event.pointerId)) {
      vectorPreview.releasePointerCapture(event.pointerId);
    }
    vectorPreview.classList.remove('lassoing');
    commitLassoLayer();
    return;
  }
  if (activeEraserStroke?.pointerId === event.pointerId) {
    if (vectorPreview.hasPointerCapture(event.pointerId)) {
      vectorPreview.releasePointerCapture(event.pointerId);
    }
    vectorPreview.classList.remove('erasing');
    commitEraserStroke();
    return;
  }
  if (!draggedPreviewLayer) return;
  const movedLayer = draggedPreviewLayer;
  draggedPreviewLayer = undefined;
  if (vectorPreview.hasPointerCapture(event.pointerId)) {
    vectorPreview.releasePointerCapture(event.pointerId);
  }
  vectorPreview.classList.remove('dragging-layer');
  if (movedLayer.moved) {
    pushLayerHistory();
    saveLayerPositions(movedLayer.layers);
    status.classList.remove('error');
    status.textContent = movedLayer.layers.length === 1
      ? `Moved layer ${movedLayer.layerNumber}.`
      : `Moved ${movedLayer.layers.length} selected layers.`;
  } else {
    renderLayerPreview();
    selectLayerFromPreview(
      movedLayer.layerNumber,
      movedLayer.additiveSelection
    );
  }
});

vectorPreview.addEventListener('pointercancel', (event) => {
  if (draggedCanvasPan?.pointerId === event.pointerId) {
    draggedCanvasPan = undefined;
    vectorStage.classList.remove('panning-canvas');
    return;
  }
  if (activeLassoStroke) {
    activeLassoStroke.preview.remove();
    activeLassoStroke = undefined;
    vectorPreview.classList.remove('lassoing');
    renderLayerPreview();
  }
  if (activeEraserStroke) {
    activeEraserStroke = undefined;
    vectorPreview.classList.remove('erasing');
    renderLayerPreview();
  }
  draggedPreviewLayer = undefined;
  vectorPreview.classList.remove('dragging-layer');
  renderLayerPreview();
});

vectorPreview.addEventListener('pointerleave', () => {
  lastVectorPointer = undefined;
  if (!activeEraserStroke) {
    lastEraserPointer = undefined;
    eraserCursor.hidden = true;
  }
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
duplicateSelectedLayers.addEventListener('click', duplicateSelectedLayerEntries);
mergeSelectedLayers.addEventListener('click', mergeSelectedLayerEntries);
resetLayerPositions.addEventListener('click', resetAllLayerPositions);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cancelVectorization()) {
    event.preventDefault();
    return;
  }
  const editingText = event.target.matches?.(
    'input[type="text"], input[type="number"], textarea, [contenteditable="true"]'
  );
  if (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    !editingText &&
    selectedLayerNumbers().length > 0
  ) {
    event.preventDefault();
    deleteSelectedLayerEntries();
    return;
  }
  if (
    event.key === 'Escape' &&
    (vectorZoomTool || eraserToolActive || lassoToolActive || bucketToolActive)
  ) {
    if (activeLassoStroke) {
      activeLassoStroke.preview.remove();
      activeLassoStroke = undefined;
      vectorPreview.classList.remove('lassoing');
      renderLayerPreview();
    }
    vectorZoomTool = undefined;
    eraserToolActive = false;
    lassoToolActive = false;
    bucketToolActive = false;
    updateVectorZoomTool();
    status.textContent = '';
    return;
  }
  const zoomInKey = event.key === '+' || event.code === 'NumpadAdd';
  const zoomOutKey = event.key === '-' || event.code === 'NumpadSubtract';
  if (
    !editingText &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    (zoomInKey || zoomOutKey) &&
    !vectorPreview.hidden
  ) {
    event.preventDefault();
    if (!lastVectorPointer) {
      vectorPreview.style.setProperty('--vector-preview-origin-x', '50%');
      vectorPreview.style.setProperty('--vector-preview-origin-y', '50%');
    }
    setVectorPreviewZoom(
      vectorPreviewZoom + (zoomInKey ? 0.25 : -0.25),
      lastVectorPointer
    );
    status.classList.remove('error');
    status.textContent = `Vector preview zoomed to ${Math.round(vectorPreviewZoom * 100)}%.`;
    return;
  }
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
  const cursorActive =
    !vectorZoomTool && !eraserToolActive && !lassoToolActive && !bucketToolActive;
  vectorCursorTool.classList.toggle('active', cursorActive);
  vectorEraserTool.classList.toggle('active', eraserToolActive);
  vectorLassoTool.classList.toggle('active', lassoToolActive);
  fillSelectedLayers.classList.toggle('active', bucketToolActive);
  vectorZoomIn.classList.toggle('active', vectorZoomTool === 'in');
  vectorZoomOut.classList.toggle('active', vectorZoomTool === 'out');
  vectorCursorTool.setAttribute('aria-pressed', String(cursorActive));
  vectorEraserTool.setAttribute('aria-pressed', String(eraserToolActive));
  vectorLassoTool.setAttribute('aria-pressed', String(lassoToolActive));
  fillSelectedLayers.setAttribute('aria-pressed', String(bucketToolActive));
  vectorZoomIn.setAttribute('aria-pressed', String(vectorZoomTool === 'in'));
  vectorZoomOut.setAttribute('aria-pressed', String(vectorZoomTool === 'out'));
  vectorPreview.classList.toggle('zoom-in-tool', vectorZoomTool === 'in');
  vectorPreview.classList.toggle('zoom-out-tool', vectorZoomTool === 'out');
  vectorPreview.classList.toggle('eraser-tool', eraserToolActive);
  vectorPreview.classList.toggle('lasso-tool', lassoToolActive);
  vectorPreview.classList.toggle('bucket-tool', bucketToolActive);
  if (!eraserToolActive) {
    lastEraserPointer = undefined;
    eraserCursor.hidden = true;
  }
}

function selectVectorZoomTool(tool) {
  vectorZoomTool = vectorZoomTool === tool ? undefined : tool;
  eraserToolActive = false;
  lassoToolActive = false;
  bucketToolActive = false;
  updateVectorZoomTool();
  status.classList.remove('error');
  status.textContent = vectorZoomTool
    ? `Zoom ${vectorZoomTool} selected. Click the vector preview.`
    : '';
}

function setVectorPreviewZoom(nextZoom, focalEvent) {
  let focalPoint;
  if (focalEvent) {
    const bounds = vectorPreview.getBoundingClientRect();
    focalPoint = {
      clientX: focalEvent.clientX,
      clientY: focalEvent.clientY,
      x: Math.max(0, Math.min(1, (focalEvent.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (focalEvent.clientY - bounds.top) / bounds.height))
    };
  }
  vectorPreviewZoom = Math.max(0.5, Math.min(4, nextZoom));
  vectorPreview.style.setProperty('--vector-preview-zoom', vectorPreviewZoom);
  if (focalPoint) {
    const bounds = vectorPreview.getBoundingClientRect();
    vectorStage.scrollLeft +=
      bounds.left + (bounds.width * focalPoint.x) - focalPoint.clientX;
    vectorStage.scrollTop +=
      bounds.top + (bounds.height * focalPoint.y) - focalPoint.clientY;
  }
  vectorZoomValue.textContent = `${Math.round(vectorPreviewZoom * 100)}%`;
  vectorZoomOut.disabled = vectorPreviewZoom <= 0.5;
  vectorZoomIn.disabled = vectorPreviewZoom >= 4;
  if (eraserToolActive && lastEraserPointer) updateEraserCursor();
}

vectorCursorTool.addEventListener('click', () => {
  vectorZoomTool = undefined;
  eraserToolActive = false;
  lassoToolActive = false;
  bucketToolActive = false;
  updateVectorZoomTool();
  status.textContent = '';
});
vectorEraserTool.addEventListener('click', () => {
  eraserToolActive = !eraserToolActive;
  vectorZoomTool = undefined;
  lassoToolActive = false;
  bucketToolActive = false;
  updateVectorZoomTool();
  status.classList.remove('error');
  status.textContent = eraserToolActive
    ? 'Eraser selected. Drag over the preview to erase from selected layers.'
    : '';
});
vectorLassoTool.addEventListener('click', () => {
  lassoToolActive = !lassoToolActive;
  vectorZoomTool = undefined;
  eraserToolActive = false;
  bucketToolActive = false;
  updateVectorZoomTool();
  status.classList.remove('error');
  status.textContent = lassoToolActive
    ? 'Lasso selected. Draw around content on exactly one selected layer.'
    : '';
});
fillSelectedLayers.addEventListener('click', () => {
  bucketToolActive = !bucketToolActive;
  vectorZoomTool = undefined;
  eraserToolActive = false;
  lassoToolActive = false;
  updateVectorZoomTool();
  status.classList.remove('error');
  status.textContent = bucketToolActive
    ? 'Bucket selected. Click artwork in the preview to apply the chosen color.'
    : '';
});
eraserSize.addEventListener('input', () => {
  eraserSizeValue.value = eraserSize.value;
  updateEraserCursor();
});
vectorZoomOut.addEventListener('click', () => selectVectorZoomTool('out'));
vectorZoomIn.addEventListener('click', () => selectVectorZoomTool('in'));
vectorZoomValue.addEventListener('click', () => {
  vectorZoomTool = undefined;
  eraserToolActive = false;
  lassoToolActive = false;
  bucketToolActive = false;
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
  eraserToolActive = false;
  lassoToolActive = false;
  bucketToolActive = false;
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

addVariation.addEventListener('click', () => {
  const count = Number(colorCount.value);
  if (paletteVariationCounts.includes(count)) {
    status.classList.remove('error');
    status.textContent = `${count} colors is already in the variation set.`;
    return;
  }
  paletteVariationCounts = [...paletteVariationCounts, count]
    .sort((left, right) => left - right);
  renderVariationChips();
  saveSettings();
  clearVectorResult();
  status.classList.remove('error');
  status.textContent = `${count} colors added. Generate the updated variation set.`;
});

for (const preset of document.querySelectorAll('[data-variation-preset]')) {
  preset.addEventListener('click', () => {
    paletteVariationCounts = preset.dataset.variationPreset
      .split(',')
      .map(Number);
    renderVariationChips();
    saveSettings();
    clearVectorResult();
  });
}

multipleVariations.addEventListener('change', () => {
  if (
    multipleVariations.checked &&
    !paletteVariationCounts.includes(Number(colorCount.value))
  ) {
    paletteVariationCounts = [...paletteVariationCounts, Number(colorCount.value)]
      .sort((left, right) => left - right);
  }
  updateOutputs();
  saveSettings();
  clearVectorResult();
  if (file) {
    status.textContent = multipleVariations.checked
      ? 'Choose palette counts, then generate the variations.'
      : 'Updating vector preview…';
    if (!multipleVariations.checked) scheduleAutomaticPreview(0);
  }
});

function commitSliderUpdate(slider) {
  if (!pendingSliderUpdates.has(slider)) return;
  pendingSliderUpdates.delete(slider);
  if (
    slider === colorCount &&
    vectorMode.value === 'multicolor' &&
    multipleVariations.checked
  ) {
    status.classList.remove('error');
    status.textContent = paletteVariationCounts.includes(Number(colorCount.value))
      ? `${colorCount.value} colors is already in the variation set.`
      : `Add ${colorCount.value} colors to the variation set when ready.`;
    return;
  }
  scheduleAutomaticPreview(0);
}

for (const slider of sliders) {
  slider.addEventListener('input', () => {
    pendingSliderUpdates.add(slider);
    updateOutputs();
    saveSettings();
    if (
      slider === colorCount &&
      vectorMode.value === 'multicolor' &&
      multipleVariations.checked
    ) {
      status.classList.remove('error');
      status.textContent = `Release the slider, then add ${colorCount.value} colors.`;
      return;
    }
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
  fillColorGaps,
  allowTraceUpscaling
]) {
  input.addEventListener('change', () => {
    updateOutputs();
    saveSettings();
    captureLayerConfiguration();
    clearVectorResult();
    scheduleAutomaticPreview(0);
  });
}

function vectorizationForm(paletteCount) {
  const form = new FormData();
  form.append('image', file);
  form.append('targetHeightMm', targetHeight.value);
  form.append('mode', vectorMode.value);
  form.append('svgStructure', svgStructure.value);
  form.append('threshold', threshold.value);
  form.append('colorCount', paletteCount);
  form.append('removeBackground', String(removeBackground.checked));
  form.append('keepWhiteLayer', String(keepWhiteLayer.checked));
  form.append('fillColorGaps', String(fillColorGaps.checked));
  form.append('maximumTraceSide', maximumTraceSide.value);
  form.append('allowTraceUpscaling', String(allowTraceUpscaling.checked));
  form.append('curveSmoothing', curveSmoothing.value);
  return form;
}

async function requestVectorization(paletteCount, signal) {
  const response = await fetch('/api/vectorize', {
    method: 'POST',
    body: vectorizationForm(paletteCount),
    signal
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Vectorization failed.');
  }
  let palette = [];
  try {
    palette = JSON.parse(
      decodeURIComponent(response.headers.get('X-Vector-Palette') || '[]')
    );
  } catch {
    // The SVG preview remains usable if optional palette metadata is absent.
  }
  return {
    count: paletteCount,
    palette,
    svgText: await response.text(),
    layers: palette.map(() => ({ visible: true, selected: false })),
    undoHistory: [],
    redoHistory: []
  };
}

async function generatePreview() {
  if (!file) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = undefined;
  const batchMode = vectorMode.value === 'multicolor' && multipleVariations.checked;
  if (batchMode) {
    pendingLayerConfiguration = undefined;
  } else {
    captureLayerConfiguration();
  }
  clearVectorResult();
  const requestRevision = resultRevision;
  previewController = new AbortController();
  previewButton.disabled = true;
  downloadButton.disabled = true;
  downloadPdfButton.disabled = true;
  status.classList.remove('error');
  const counts = batchMode ? paletteVariationCounts : [Number(colorCount.value)];
  status.textContent = batchMode
    ? `Generating ${counts.length} palette variations…`
    : `Vectorizing ${vectorMode.value} artwork…`;
  showProcessing(
    5,
    batchMode
      ? `Preparing variation 1 of ${counts.length}…`
      : 'Uploading source image…'
  );
  try {
    for (let index = 0; index < counts.length; index += 1) {
      const count = counts[index];
      const startPercent = 5 + ((index / counts.length) * 85);
      showProcessing(
        startPercent,
        batchMode
          ? `Generating variation ${index + 1} of ${counts.length} · ${count} colors…`
          : vectorMode.value === 'multicolor'
            ? `Tracing ${count} color layers…`
            : 'Tracing monochrome SVG paths…'
      );
      const result = await requestVectorization(
        count,
        previewController.signal
      );
      if (requestRevision !== resultRevision) return;
      if (batchMode) {
        paletteVariationResults.set(count, result);
        renderVariationGallery();
      } else {
        vectorSvgText = result.svgText;
        let palette = result.palette;
        const restoredLayers = restoreLayerConfiguration(palette);
        palette = restoredLayers.palette;
        refreshDownloadUrl();
        showPalette(palette);
        restoreLayerPanelState(restoredLayers.configuration);
        renderLayerPreview();
        vectorPreview.hidden = false;
        vectorPlaceholder.hidden = true;
        downloadButton.disabled = false;
        downloadPdfButton.disabled = false;
        status.textContent = restoredLayers.restored
          ? 'Vector preview ready. Layer settings preserved.'
          : 'Vector preview ready.';
      }
    }
    if (batchMode) {
      const preferredCount = paletteVariationResults.has(Number(colorCount.value))
        ? Number(colorCount.value)
        : counts[0];
      activateVariation(preferredCount);
      status.textContent =
        `${counts.length} palette variations ready. Select one to edit its layers.`;
    }
    showProcessing(95, batchMode ? 'Rendering palette gallery…' : 'Rendering vector preview…');
    finishProcessing(true);
  } catch (error) {
    if (error.name === 'AbortError') {
      if (batchMode && paletteVariationResults.size > 0) {
        activateVariation(paletteVariationResults.keys().next().value);
        status.textContent =
          `Vectorization canceled. ${paletteVariationResults.size} completed variation preserved.`;
      }
      return;
    }
    if (batchMode && paletteVariationResults.size > 0) {
      activateVariation(paletteVariationResults.keys().next().value);
    }
    status.classList.add('error');
    status.textContent = batchMode && paletteVariationResults.size > 0
      ? `${error.message} Completed variations remain available.`
      : error.message;
    finishProcessing(false);
  } finally {
    if (requestRevision === resultRevision) {
      previewController = undefined;
      previewButton.disabled = false;
    }
  }
}

previewButton.addEventListener('click', generatePreview);

downloadButton.addEventListener('click', () => {
  if (activeVariationCount !== undefined) {
    saveActiveVariation();
    const result = paletteVariationResults.get(activeVariationCount);
    if (!result) return;
    downloadVariation(result);
    status.classList.remove('error');
    status.textContent = `${activeVariationCount}-color SVG downloaded.`;
    return;
  }
  if (!vectorDownloadUrl) return;
  downloadSvgText(vectorSvgText, 'original-vectorized.svg');
  status.classList.remove('error');
  status.textContent = 'Vector SVG downloaded.';
});

downloadPdfButton.addEventListener('click', async () => {
  if (!vectorSvgText) return;
  if (activeVariationCount !== undefined) saveActiveVariation();
  downloadPdfButton.disabled = true;
  status.classList.remove('error');
  status.textContent = 'Creating CorelDRAW vector PDF…';
  showProcessing(25, 'Converting SVG paths to vector PDF…');
  try {
    const response = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml' },
      body: svgTextForDownload(vectorSvgText, true)
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'PDF export failed.');
    }
    showProcessing(85, 'Preparing PDF download…');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = activeVariationCount === undefined
      ? 'original-vectorized-coreldraw.pdf'
      : `original-vectorized-${activeVariationCount}-colors-coreldraw.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    status.textContent = 'CorelDRAW vector PDF downloaded.';
    finishProcessing(true);
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
    finishProcessing(false);
  } finally {
    downloadPdfButton.disabled = !vectorSvgText;
  }
});

restoreSettings();
updateOutputs();
