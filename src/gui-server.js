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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const upload = multer({ dest: path.join(os.tmpdir(), 'image-panel-splitter-uploads') });
const app = express();
const PANEL_LIMITS_IN = {
  a4: { landscape: { width: 9.26, height: 6.55 }, portrait: { width: 6.55, height: 9.26 } },
  letter: { landscape: { width: 9.26, height: 6.55 }, portrait: { width: 6.55, height: 9.26 } },
  legal: { landscape: { width: 11.84, height: 6.76 }, portrait: { width: 6.76, height: 11.84 } }
};

app.use(express.static(publicDir));

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(rootDir, 'src', 'index.js'), ...args], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || stdout || `Splitter exited with code ${code}`));
    });
  });
}

app.post('/api/export', upload.single('image'), async (req, res) => {
  let workDir;
  try {
    if (!req.file) throw new Error('Please select a PNG image.');
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'image-panel-splitter-'));
    const outputDir = path.join(workDir, 'panels');
    const panelWidth = Number(req.body.panelWidthIn);
    const panelHeight = Number(req.body.panelHeightIn);
    const paper = String(req.body.paper || 'a4').toLowerCase();
    const orientation = String(req.body.orientation || 'landscape').toLowerCase();
    const dpi = Number(req.body.dpi || 144);
    const targetHeightMm = Number(req.body.targetHeightMm || 0);
    const gridLineWidthMm = Number(req.body.gridLineWidthMm || 1);
    if (!(panelWidth > 0) || !(panelHeight > 0)) throw new Error('Panel dimensions must be greater than zero.');
    if (!PANEL_LIMITS_IN[paper]) throw new Error('Paper size must be a4, letter, or legal.');
    if (!['portrait', 'landscape'].includes(orientation)) throw new Error('Orientation must be portrait or landscape.');
    const { width: maxWidth, height: maxHeight } = PANEL_LIMITS_IN[paper][orientation];
    if (panelWidth > maxWidth) throw new Error(`For ${paper} ${orientation}, panel width cannot exceed ${maxWidth} in.`);
    if (panelHeight > maxHeight) throw new Error(`For ${paper} ${orientation}, panel height cannot exceed ${maxHeight} in.`);
    if (!(dpi > 0)) throw new Error('DPI must be greater than zero.');

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
      '--grid-color', req.body.gridColor || 'red'
    ];
    if (targetHeightMm > 0) args.push('--target-height-mm', String(targetHeightMm));
    else args.push('--fit', 'actual');
    if (req.body.printNumbers !== 'true') args.push('--no-number');
    else {
      args.push('--number-position', req.body.numberPosition || 'inside');
      args.push('--number-size-mm', String(Number(req.body.numberSizeMm || 30)));
    }

    await runCli(args);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="poster-panels.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => { throw error; });
    archive.pipe(res);
    archive.directory(outputDir, false);
    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(400).json({ error: error.message });
    else res.destroy(error);
  } finally {
    if (req.file?.path) fsp.rm(req.file.path, { force: true }).catch(() => {});
    if (workDir) setTimeout(() => fsp.rm(workDir, { recursive: true, force: true }).catch(() => {}), 30_000);
  }
});

const port = Number(process.env.PORT || 4173);
app.listen(port, () => {
  console.log(`Image Panel Splitter GUI: http://localhost:${port}`);
});
