import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
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
  try {
    if (!req.file) throw new Error('Choose an image to vectorize.');
    const result = await vectorizeMonochrome(req.file.buffer, {
      targetHeightMm: Number(req.body.targetHeightMm || 1000),
      threshold: Number(req.body.threshold || 200),
      maximumTraceSide: Number(req.body.maximumTraceSide || 3000),
      curveSmoothing: Number(req.body.curveSmoothing ?? 50),
      mode: req.body.mode || 'monochrome',
      svgStructure: req.body.svgStructure || 'groups',
      colorCount: Number(req.body.colorCount || 6),
      removeBackground: req.body.removeBackground !== 'false',
      keepWhiteLayer: req.body.keepWhiteLayer !== 'false',
      fillColorGaps: req.body.fillColorGaps !== 'false'
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
    console.error('Vectorization failed.', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

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
