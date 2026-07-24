#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

function run(command, args, { cwd, capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: false
  });

  if (result.error && !allowFailure) fail(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    const details = capture ? (result.stderr || result.stdout || '').trim() : '';
    fail(`${command} exited with code ${result.status}.${details ? ` ${details}` : ''}`);
  }
  return result;
}

function captured(command, args, cwd) {
  const result = run(command, args, { cwd, capture: true, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function readPackage(projectDirectory) {
  try {
    return JSON.parse(readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
}

if (['--help', '-h'].includes(process.argv[2])) {
  console.log(`Usage:
  node scripts/install-update.mjs
  node install-update.mjs [install-directory]

Inside an existing clone, the script updates that clone.
Outside a clone, it installs into the given directory or ./ronyka-panel-splitter.

Optional environment variables:
  RONYKA_REPOSITORY_URL  Git repository URL
  RONYKA_BRANCH          Branch to install/update (default: main)`);
  process.exit(0);
}

const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 9)) {
  fail(`Node.js 20.9.0 or newer is required; found ${process.version}.`);
}

run('git', ['--version'], { capture: true });
run(npmCommand, ['--version'], { capture: true });

let projectDirectory;
const candidateRoot = captured('git', ['-C', scriptDirectory, 'rev-parse', '--show-toplevel']);
if (candidateRoot && readPackage(candidateRoot)?.name === 'image-panel-splitter') {
  projectDirectory = candidateRoot;
  log(`Using existing installation: ${projectDirectory}`);

  const status = captured('git', ['-C', projectDirectory, 'status', '--porcelain']);
  if (status) fail('Local changes are present. Commit or stash them before updating.');

  const currentBranch = captured('git', ['-C', projectDirectory, 'branch', '--show-current']);
  if (currentBranch !== branchName) {
    fail(`Expected branch '${branchName}', but the installation is on '${currentBranch}'.`);
  }

  log(`Fetching ${branchName} from origin...`);
  run('git', ['-C', projectDirectory, 'fetch', 'origin', branchName]);

  log('Applying a fast-forward-only update...');
  run('git', ['-C', projectDirectory, 'merge', '--ff-only', `origin/${branchName}`]);
} else {
  projectDirectory = path.resolve(process.argv[2] || path.join(process.cwd(), 'ronyka-panel-splitter'));
  if (existsSync(projectDirectory)) fail(`Install directory already exists: ${projectDirectory}`);

  log(`Cloning ${repositoryUrl} into ${projectDirectory}...`);
  run('git', ['clone', '--branch', branchName, '--single-branch', repositoryUrl, projectDirectory]);
}

log('Installing locked npm dependencies...');
run(npmCommand, ['ci'], { cwd: projectDirectory });

const installedVersion = readPackage(projectDirectory)?.version;
log(`Installation ready (v${installedVersion}).`);
log(`Start the GUI from ${projectDirectory} with: npm run gui`);
