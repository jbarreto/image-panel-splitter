import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import sharp from 'sharp';
import { traceBinaryMask, vectorizeMonochrome } from './tracer.js';

const app = express();
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4174);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

app.use(express.static(path.join(rootDir, 'public')));
app.use(express.json({ limit: '25mb' }));

app.post('/api/flood-fill', async (req, res) => {
  try {
    const svg = String(req.body.svg || '');
    const viewWidth = Number(req.body.viewWidth);
    const viewHeight = Number(req.body.viewHeight);
    const sourceX = Number(req.body.x);
    const sourceY = Number(req.body.y);
    const curveSmoothing = Number(req.body.curveSmoothing ?? 50);
    if (!svg.includes('<svg') || !viewWidth || !viewHeight) {
      throw new Error('The vector preview is not available for region filling.');
    }
    const scale = Math.min(1, 4000 / Math.max(viewWidth, viewHeight));
    const width = Math.max(1, Math.round(viewWidth * scale));
    const height = Math.max(1, Math.round(viewHeight * scale));
    const rasterSvg = svg.replace(/<svg\b([^>]*)>/i, (_match, attributes) => {
      const sizedAttributes = attributes
        .replace(/\swidth=(?:"[^"]*"|'[^']*')/gi, '')
        .replace(/\sheight=(?:"[^"]*"|'[^']*')/gi, '');
      return `<svg${sizedAttributes} width="${width}" height="${height}">`;
    });
    const { data } = await sharp(Buffer.from(rasterSvg), { limitInputPixels: false })
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const startX = Math.max(0, Math.min(width - 1, Math.floor(sourceX * scale)));
    const startY = Math.max(0, Math.min(height - 1, Math.floor(sourceY * scale)));
    const startOffset = (startY * width + startX) * 4;
    const target = [
      data[startOffset],
      data[startOffset + 1],
      data[startOffset + 2],
      data[startOffset + 3]
    ];
    const toleranceSquared = 24 ** 2 * 3;
    const visited = new Uint8Array(width * height);
    const mask = new Int8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    let touchesBorder = false;
    queue[tail++] = startY * width + startX;
    visited[queue[0]] = 1;
    const matchesTarget = (pixel) => {
      const offset = pixel * 4;
      const alphaDifference = data[offset + 3] - target[3];
      return (
        (data[offset] - target[0]) ** 2 +
        (data[offset + 1] - target[1]) ** 2 +
        (data[offset + 2] - target[2]) ** 2 +
        alphaDifference ** 2 <= toleranceSquared
      );
    };
    while (head < tail) {
      const pixel = queue[head++];
      if (!matchesTarget(pixel)) continue;
      mask[pixel] = 1;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesBorder = true;
      }
      for (const neighbor of [
        x > 0 ? pixel - 1 : -1,
        x + 1 < width ? pixel + 1 : -1,
        y > 0 ? pixel - width : -1,
        y + 1 < height ? pixel + width : -1
      ]) {
        if (neighbor < 0 || visited[neighbor]) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    const area = mask.reduce((sum, value) => sum + value, 0);
    if (area < 4) throw new Error('The selected enclosed region is too small to fill.');
    if (touchesBorder) {
      throw new Error('The selected area is open to the canvas edge and is not enclosed.');
    }
    const pathData = await traceBinaryMask(
      mask,
      width,
      height,
      Math.min(50, Math.max(0, curveSmoothing))
    );
    if (!pathData) throw new Error('Could not trace the selected enclosed region.');
    res.json({ pathData, width, height, viewWidth, viewHeight, area });
  } catch (error) {
    console.error('Region fill failed.', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/vectorize', upload.single('image'), async (req, res) => {
  const cancellation = new AbortController();
  req.once('aborted', () => cancellation.abort());
  res.once('close', () => {
    if (!res.writableEnded) cancellation.abort();
  });
  try {
    if (!req.file) throw new Error('Choose an image to vectorize.');
    const result = await vectorizeMonochrome(req.file.buffer, {
      targetHeightMm: Number(req.body.targetHeightMm || 1000),
      threshold: Number(req.body.threshold || 200),
      maximumTraceSide: Number(req.body.maximumTraceSide || 3000),
      allowTraceUpscaling: req.body.allowTraceUpscaling === 'true',
      curveSmoothing: Number(req.body.curveSmoothing ?? 50),
      mode: req.body.mode || 'monochrome',
      svgStructure: req.body.svgStructure || 'groups',
      findEdges: req.body.findEdges === 'true',
      colorCount: Number(req.body.colorCount || 6),
      removeBackground: req.body.removeBackground !== 'false',
      keepWhiteLayer: req.body.keepWhiteLayer !== 'false',
      fillColorGaps: req.body.fillColorGaps !== 'false',
      signal: cancellation.signal
    });
    console.debug('Vectorization complete.', {
      originalName: req.file.originalname,
      uploadBytes: req.file.size,
      source: result.source,
      trace: result.trace,
      output: result.output,
      mode: result.mode,
      colors: result.colors,
      svgBytes: Buffer.byteLength(result.svg)
    });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="original-vectorized.svg"');
    res.setHeader('X-Vector-Mode', result.mode);
    res.setHeader(
      'X-Vector-Palette',
      encodeURIComponent(JSON.stringify(result.palette))
    );
    res.send(result.svg);
  } catch (error) {
    if (error.name === 'AbortError' || cancellation.signal.aborted) {
      console.debug('Vectorization canceled.', {
        originalName: req.file?.originalname
      });
      return;
    }
    console.error('Vectorization failed.', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

app.post(
  '/api/export-pdf',
  express.text({ type: ['image/svg+xml', 'text/plain'], limit: '100mb' }),
  async (req, res) => {
    try {
      const svg = req.body;
      if (typeof svg !== 'string' || !svg.includes('<svg')) {
        throw new Error('A valid SVG is required for PDF export.');
      }
      const widthMm = Number(svg.match(/\bwidth="([\d.]+)mm"/)?.[1]);
      const heightMm = Number(svg.match(/\bheight="([\d.]+)mm"/)?.[1]);
      if (
        !Number.isFinite(widthMm) ||
        !Number.isFinite(heightMm) ||
        widthMm <= 0 ||
        heightMm <= 0
      ) {
        throw new Error('The SVG must include physical width and height in millimeters.');
      }
      const widthPoints = widthMm * 72 / 25.4;
      const heightPoints = heightMm * 72 / 25.4;
      const document = new PDFDocument({
        autoFirstPage: false,
        compress: true,
        margin: 0
      });
      const chunks = [];
      document.on('data', (chunk) => chunks.push(chunk));
      const complete = new Promise((resolve, reject) => {
        document.once('end', resolve);
        document.once('error', reject);
      });
      document.addPage({ size: [widthPoints, heightPoints], margin: 0 });
      SVGtoPDF(document, svg, 0, 0, {
        width: widthPoints,
        height: heightPoints,
        preserveAspectRatio: 'xMidYMid meet',
        assumePt: true
      });
      document.end();
      await complete;
      const pdf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="original-vectorized-coreldraw.pdf"'
      );
      res.send(pdf);
    } catch (error) {
      console.error('Vector PDF export failed.', { error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
);

app.use((error, req, res, next) => {
  if (!error) return next();
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'The selected image exceeds the 50 MB upload limit.'
    : error.message;
  res.status(400).json({ error: message });
});

const server = app.listen(port, () => {
  console.log(`Ronyka Vectorizer running at http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
