import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { vectorizeMonochrome } from './tracer.js';

const app = express();
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4174);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

app.use(express.static(path.join(rootDir, 'public')));

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
