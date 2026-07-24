#!/usr/bin/env node
import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const tempDir = os.tmpdir();
const uploadDir = path.join(tempDir, 'image-panel-splitter-uploads');
const exportDirPrefix = 'image-panel-splitter-';
const staleTempAgeMs = 24 * 60 * 60 * 1000;
const cleanupIntervalMs = 60 * 60 * 1000;
const progressRetentionMs = 10 * 60 * 1000;
const progressCleanupIntervalMs = 60 * 1000;
const upload = multer({ dest: uploadDir });
const app = express();
const exportProgress = new Map();
const exportJobs = new Map();
const PANEL_LIMITS_IN = {
  letter: { landscape: { width: 9.26, height: 6.55 }, portrait: { width: 6.55, height: 9.26 } },
  legal: { landscape: { width: 11.84, height: 6.76 }, portrait: { width: 6.76, height: 11.84 } }
};

app.use(express.static(publicDir));

async function removeIfStale(targetPath, now) {
  try {
    const stats = await fsp.stat(targetPath);
    if (now - stats.mtimeMs < staleTempAgeMs) return false;
    await fsp.rm(targetPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function cleanupStaleTempFiles() {
  const now = Date.now();
  let removed = 0;

  try {
    const entries = await fsp.readdir(tempDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        entry.name.startsWith(exportDirPrefix) &&
        entry.name !== path.basename(uploadDir)
      ) {
        if (await removeIfStale(path.join(tempDir, entry.name), now)) removed += 1;
      }
    }
  } catch (error) {
    logger.warn('Could not clean stale export directories.', { error: error.message });
  }

  try {
    const uploads = await fsp.readdir(uploadDir, { withFileTypes: true });
    for (const entry of uploads) {
      if (await removeIfStale(path.join(uploadDir, entry.name), now)) removed += 1;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn('Could not clean stale uploads.', { error: error.message });
    }
  }

  if (removed > 0) logger.info('Removed stale temporary items.', { removed });
  else logger.debug('Temporary-file cleanup completed; no stale items found.');
}

function runCli(args, onOutputLine, job) {
  return new Promise((resolve, reject) => {
    logger.debug('Starting splitter child process.', { exportId: job.id });
    const child = spawn(process.execPath, [path.join(rootDir, 'src', 'index.js'), ...args], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    job.child = child;
    if (job.canceled) child.kill();
    let stdout = '';
    let stderr = '';
    let pendingLine = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      const lines = `${pendingLine}${text}`.split(/\r?\n/);
      pendingLine = lines.pop() || '';
      for (const line of lines) onOutputLine?.(line);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      logger.debug('Splitter child log.', { exportId: job.id, output: text.trim() });
    });
    child.on('error', reject);
    child.on('close', (code) => {
      job.child = undefined;
      logger.debug('Splitter child process closed.', { exportId: job.id, code, canceled: job.canceled });
      if (pendingLine) onOutputLine?.(pendingLine);
      if (job.canceled) reject(new Error('Export canceled.'));
      else if (code === 0) resolve(stdout);
      else {
        const cliErrors = [...stderr.matchAll(/(?:^|\s)Error: ([^\n]+)/g)];
        const message = cliErrors.at(-1)?.[1] || `Splitter exited with code ${code}`;
        reject(new Error(message));
      }
    });
  });
}

app.get('/api/export-progress/:id', (req, res) => {
  const progress = exportProgress.get(req.params.id);
  if (!progress) {
    res.status(404).json({ error: 'Export progress is not available yet.' });
    return;
  }
  res.json(progress);
});

app.delete('/api/export/:id', (req, res) => {
  const job = exportJobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Active export not found.' });
    return;
  }
  logger.info('Canceling active export.', { exportId: req.params.id });
  job.canceled = true;
  job.child?.kill();
  job.archive?.abort();
  job.response?.destroy();
  res.status(202).json({ canceled: true });
});

app.post('/api/export', upload.single('image'), async (req, res) => {
  let workDir;
  let workDirCleanup;
  let job;
  const exportId = String(req.body.exportId || '');
  const updateProgress = (changes) => {
    if (!exportId) return;
    exportProgress.set(exportId, {
      ...exportProgress.get(exportId),
      ...changes,
      updatedAt: Date.now()
    });
  };
  try {
    if (!req.file) throw new Error('Please select a PNG image.');
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(exportId)) throw new Error('A valid export ID is required.');
    job = { id: exportId, canceled: false, finished: false, response: res };
    exportJobs.set(exportId, job);
    logger.info('Export request accepted.', {
      exportId,
      originalName: req.file.originalname,
      uploadBytes: req.file.size
    });
    updateProgress({ phase: 'preparing', completed: 0, total: 0 });
    workDir = await fsp.mkdtemp(path.join(tempDir, exportDirPrefix));
    logger.debug('Created temporary export directory.', { exportId, workDir });
    let cleanupStarted = false;
    workDirCleanup = () => {
      if (cleanupStarted) return;
      cleanupStarted = true;
      fsp.rm(workDir, { recursive: true, force: true }).catch((error) => {
        logger.warn('Could not remove temporary export directory.', {
          exportId,
          workDir,
          error: error.message
        });
      });
    };
    res.once('finish', workDirCleanup);
    res.once('close', () => {
      workDirCleanup();
      if (!job.finished && !job.canceled) {
        job.canceled = true;
        job.child?.kill();
        job.archive?.abort();
      }
    });

    const outputDir = path.join(workDir, 'panels');
    const panelWidth = Number(req.body.panelWidthIn);
    const panelHeight = Number(req.body.panelHeightIn);
    const paper = String(req.body.paper || 'letter').toLowerCase();
    const orientation = String(req.body.orientation || 'landscape').toLowerCase();
    const dpi = Number(req.body.dpi || 144);
    const targetHeightMm = Number(req.body.targetHeightMm || 0);
    const gridLineWidthMm = Number(req.body.gridLineWidthMm || 1);
    if (!(panelWidth > 0) || !(panelHeight > 0)) throw new Error('Panel dimensions must be greater than zero.');
    if (!PANEL_LIMITS_IN[paper]) throw new Error('Paper size must be letter or legal.');
    if (!['portrait', 'landscape'].includes(orientation)) throw new Error('Orientation must be portrait or landscape.');
    const { width: maxWidth, height: maxHeight } = PANEL_LIMITS_IN[paper][orientation];
    if (panelWidth > maxWidth) throw new Error(`For ${paper} ${orientation}, panel width cannot exceed ${maxWidth} in.`);
    if (panelHeight > maxHeight) throw new Error(`For ${paper} ${orientation}, panel height cannot exceed ${maxHeight} in.`);
    if (!(dpi > 0)) throw new Error('DPI must be greater than zero.');
    logger.debug('Export options validated.', {
      exportId,
      paper,
      orientation,
      panelWidth,
      panelHeight,
      dpi,
      targetHeightMm
    });

    const args = [
      req.file.path,
      '--paper', paper,
      '--panel-width-in', String(panelWidth),
      '--panel-height-in', String(panelHeight),
      '--orientation', orientation,
      '--dpi', String(dpi),
      '--margin-mm', String(Number(req.body.marginMm || 0)),
      '--output', outputDir,
      '--prefix', req.body.prefix || 'panel',
      '--grid-lines',
      '--grid-mode', req.body.gridMode || 'overlay',
      '--grid-line-width-mm', String(gridLineWidthMm),
      '--grid-color', req.body.gridColor || '#01a86b'
    ];
    if (targetHeightMm > 0) args.push('--target-height-mm', String(targetHeightMm));
    else args.push('--fit', 'actual');
    if (req.body.printNumbers !== 'true') args.push('--no-number');
    else {
      args.push('--number-position', req.body.numberPosition || 'inside');
      args.push('--number-size-mm', String(Number(req.body.numberSizeMm || 30)));
    }

    await runCli(args, (line) => {
      const gridMatch = line.match(/=\s*(\d+)\s+panel\(s\)/);
      if (gridMatch) {
        const total = Number(gridMatch[1]);
        logger.debug('Panel layout calculated.', { exportId, total });
        updateProgress({ phase: 'generating', total });
      }
      if (line.startsWith('Created ')) {
        const current = exportProgress.get(exportId);
        updateProgress({ phase: 'generating', completed: (current?.completed || 0) + 1 });
      }
    }, job);

    logger.debug('Panel generation complete; starting ZIP archive.', { exportId });
    updateProgress({ phase: 'zipping' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="poster-panels.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    job.archive = archive;
    archive.on('error', (error) => { throw error; });
    archive.pipe(res);
    archive.directory(outputDir, false);
    await archive.finalize();
    job.finished = true;
    logger.info('Export ZIP completed.', {
      exportId,
      panels: exportProgress.get(exportId)?.completed
    });
    updateProgress({ phase: 'complete' });
  } catch (error) {
    const canceled = job?.canceled;
    updateProgress({
      phase: canceled ? 'canceled' : 'error',
      error: canceled ? 'Export canceled.' : error.message
    });
    logger[canceled ? 'info' : 'error'](canceled ? 'Export canceled.' : 'Export failed.', {
      exportId,
      error: error.message
    });
    if (!res.headersSent && !res.destroyed) {
      res.status(canceled ? 499 : 400).json({ error: canceled ? 'Export canceled.' : error.message });
    }
    else res.destroy(error);
  } finally {
    if (job) exportJobs.delete(exportId);
    if (req.file?.path) {
      fsp.rm(req.file.path, { force: true })
        .then(() => logger.debug('Removed temporary upload.', { exportId }))
        .catch((error) => logger.warn('Could not remove temporary upload.', {
          exportId,
          error: error.message
        }));
    }
    if (workDir && !res.headersSent) workDirCleanup?.();
  }
});

const port = Number(process.env.PORT || 4173);
await cleanupStaleTempFiles();
const cleanupTimer = setInterval(cleanupStaleTempFiles, cleanupIntervalMs);
cleanupTimer.unref();
const progressCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - progressRetentionMs;
  for (const [id, progress] of exportProgress) {
    if (progress.updatedAt < cutoff) exportProgress.delete(id);
  }
}, progressCleanupIntervalMs);
progressCleanupTimer.unref();
app.listen(port, () => {
  logger.info('Image Panel Splitter GUI started.', {
    url: `http://localhost:${port}`,
    logLevel: logger.level,
    tempDir
  });
});
