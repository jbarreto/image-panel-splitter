#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const repositoryUrl =
  process.env.RONYKA_REPOSITORY_URL || 'https://github.com/jbarreto/image-panel-splitter.git';
const branchName = process.env.RONYKA_BRANCH || 'main';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function log(message) {
  console.log(`[Ronyka Panel Splitter] ${message}`);
}

function fail(message) {
  console.error(`[Ronyka Panel Splitter] Error: ${message}`);
  process.exit(1);
}

function run(command, args, cwd) {
  const isWindows = process.platform === 'win32';

  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: false,
    shell: isWindows
  });
  if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}.`);
}

function readPackage(directory) {
  try {
    return JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

function findProjectRoot(startDirectory) {
  let directory = path.resolve(startDirectory);
  while (true) {
    if (readPackage(directory)?.name === 'image-panel-splitter') return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function githubArchiveUrl() {
  if (process.env.RONYKA_ARCHIVE_URL) return process.env.RONYKA_ARCHIVE_URL;
  const match = repositoryUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) {
    fail('RONYKA_REPOSITORY_URL is not a GitHub URL; set RONYKA_ARCHIVE_URL explicitly.');
  }
  const encodedBranch = branchName.split('/').map(encodeURIComponent).join('/');
  return `https://codeload.github.com/${match[1]}/${match[2]}/tar.gz/refs/heads/${encodedBranch}`;
}

function tarString(buffer, start, length) {
  return buffer.subarray(start, start + length).toString('utf8').replace(/\0.*$/, '').trim();
}

function extractGithubArchive(compressed, destination) {
  const archive = gunzipSync(compressed);
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const relativeName = fullName.split('/').slice(1).join('/');
    const size = Number.parseInt(tarString(header, 124, 12) || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (dataEnd > archive.length) fail('The downloaded GitHub archive is incomplete.');
    if (relativeName) {
      const target = path.resolve(destination, relativeName);
      const destinationRoot = `${path.resolve(destination)}${path.sep}`;
      if (!target.startsWith(destinationRoot)) fail('The GitHub archive contains an unsafe path.');

      if (type === '5') {
        mkdirSync(target, { recursive: true });
      } else if (type === '0' || type === '\0') {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, archive.subarray(dataStart, dataEnd));
      } else if (!['x', 'g'].includes(type)) {
        fail(`Unsupported entry type in GitHub archive: ${type}`);
      }
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }
}

async function downloadSource(destination) {
  const archiveUrl = githubArchiveUrl();
  log(`Downloading ${branchName} from GitHub...`);
  const response = await fetch(archiveUrl, { redirect: 'follow' });
  if (!response.ok) fail(`GitHub download failed: HTTP ${response.status}.`);
  const compressed = Buffer.from(await response.arrayBuffer());
  extractGithubArchive(compressed, destination);
  if (readPackage(destination)?.name !== 'image-panel-splitter') {
    fail('The downloaded archive is not Ronyka Panel Splitter.');
  }
}

function replaceApplicationFiles(source, destination) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    rmSync(destinationPath, { recursive: true, force: true });
    cpSync(sourcePath, destinationPath, { recursive: true, force: true });
  }
}

if (['--help', '-h'].includes(process.argv[2])) {
  console.log(`Usage:
  node scripts/install-update.mjs
  node install-update.mjs [install-directory]

Inside an existing installation, the script updates that installation.
Outside an installation, it installs into the given directory or ./ronyka-panel-splitter.

Requirements:
  Node.js 20.9.0 or newer
  npm

Optional environment variables:
  RONYKA_REPOSITORY_URL  GitHub repository URL
  RONYKA_ARCHIVE_URL     Explicit .tar.gz source archive URL
  RONYKA_BRANCH          Branch to install/update (default: main)`);
  process.exit(0);
}

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 9)) {
  fail(`Node.js 20.9.0 or newer is required; found ${process.version}.`);
}

run(npmCommand, ['--version']);

const existingProject = findProjectRoot(scriptDirectory);
const projectDirectory =
  existingProject || path.resolve(process.argv[2] || path.join(process.cwd(), 'ronyka-panel-splitter'));
const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'ronyka-panel-splitter-update-'));
const stagedSource = path.join(temporaryDirectory, 'source');

try {
  mkdirSync(stagedSource, { recursive: true });
  await downloadSource(stagedSource);

  if (existingProject) {
    log(`Updating existing installation: ${projectDirectory}`);
  } else {
    if (existsSync(projectDirectory)) fail(`Install directory already exists: ${projectDirectory}`);
    log(`Installing into ${projectDirectory}`);
    mkdirSync(projectDirectory, { recursive: true });
  }

  replaceApplicationFiles(stagedSource, projectDirectory);

  log('Installing locked npm dependencies...');
  run(npmCommand, ['ci'], projectDirectory);

  const installedVersion = readPackage(projectDirectory)?.version;
  log(`Installation ready (v${installedVersion}).`);
  log(`Start the GUI from ${projectDirectory} with: npm run gui`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
