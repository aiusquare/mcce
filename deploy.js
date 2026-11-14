#!/usr/bin/env node
/**
 * Automated FTP / SFTP Deployment Script for Maslaha Portal (AfeesHost / cPanel)
 *
 * Usage:
 *   node deploy.js --test                # Test FTP connection & remote directory structure
 *   node deploy.js --backend             # Scan & upload modified backend PHP files
 *   node deploy.js --frontend            # Build frontend & sync dist/ to remote
 *   node deploy.js --all                 # Sync both backend and frontend
 *   node deploy.js --file <path>         # Upload a specific file
 *   node deploy.js --dry-run             # Preview what would be uploaded without changing anything
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const ftp = require('basic-ftp');

const ROOT_DIR = __dirname;
const ENV_PATH = path.join(ROOT_DIR, '.deploy.env');
const CACHE_PATH = path.join(ROOT_DIR, '.deploy-cache.json');

// -----------------------------------------------------------------------------
// 1. ENVIRONMENT CONFIGURATION
// -----------------------------------------------------------------------------
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    const template = [
      '# cPanel FTP Deployment Configuration for AfeesHost',
      '# Created automatically by Antigravity',
      '',
      'FTP_HOST=mcce.org.ng',
      'FTP_PORT=21',
      'FTP_USER=aacasorg',
      'FTP_PASS=YOUR_CPANEL_OR_FTP_PASSWORD_HERE',
      'FTP_SECURE=false',
      '',
      '# Remote Paths on Server (relative to FTP root or absolute from /home/aacasorg/)',
      '# For main domain or subdomain app.mcce.org.ng:',
      'REMOTE_BACKEND_ROOT=/public_html',
      'REMOTE_FRONTEND_ROOT=/public_html',
      ''
    ].join('\n');
    fs.writeFileSync(ENV_PATH, template, 'utf8');
    console.log('\n[INIT] Created configuration template at .deploy.env');
  }

  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      env[k] = v;
    }
  }
  return env;
}

// Ensure .deploy.env and .deploy-cache.json are in .gitignore
function ensureGitignore() {
  const gitignorePath = path.join(ROOT_DIR, '.gitignore');
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  let updated = false;
  ['.deploy.env', '.deploy-cache.json', 'node_modules'].forEach((item) => {
    if (!content.includes(item)) {
      content += `\n${item}`;
      updated = true;
    }
  });
  if (updated) {
    fs.writeFileSync(gitignorePath, content.trim() + '\n', 'utf8');
  }
}

// -----------------------------------------------------------------------------
// 2. CACHE & HASH UTILITIES (Change Detection)
// -----------------------------------------------------------------------------
function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function getFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buf).digest('hex');
}

// Recursively scan directories for modified files
function scanDirectory(dir, baseDir, ignorePatterns = []) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    const shouldIgnore = ignorePatterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return relPath.includes(pattern) || file === pattern;
      }
      return pattern.test(relPath);
    });
    if (shouldIgnore) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDirectory(fullPath, baseDir, ignorePatterns));
    } else {
      results.push({
        fullPath,
        relPath,
        size: stat.size,
        mtime: stat.mtimeMs
      });
    }
  }
  return results;
}

// -----------------------------------------------------------------------------
// 3. FTP CLIENT CONNECTION
// -----------------------------------------------------------------------------
async function getConnectedClient(env, verbose = true) {
  const client = new ftp.Client();
  client.ftp.verbose = verbose;

  if (!env.FTP_HOST || !env.FTP_USER || env.FTP_PASS === 'YOUR_CPANEL_OR_FTP_PASSWORD_HERE') {
    throw new Error(
      'Please edit .deploy.env with your real cPanel / FTP credentials (FTP_USER & FTP_PASS) before deploying.'
    );
  }

  const config = {
    host: env.FTP_HOST,
    port: parseInt(env.FTP_PORT || '21', 10),
    user: env.FTP_USER,
    password: env.FTP_PASS,
    secure: env.FTP_SECURE === 'true'
  };

  if (verbose) {
    console.log(`[CONNECT] Connecting to ${config.user}@${config.host}:${config.port}...`);
  }
  await client.access(config);
  if (verbose) {
    console.log('[SUCCESS] Connected to FTP server successfully!');
  }
  return client;
}

// -----------------------------------------------------------------------------
// 4. DEPLOY ACTIONS
// -----------------------------------------------------------------------------
async function testConnection(env) {
  const client = await getConnectedClient(env, true);
  try {
    console.log('\n[REMOTE] Listing remote root directory:');
    const remoteBackend = env.REMOTE_BACKEND_ROOT || '/public_html';
    try {
      await client.cd(remoteBackend);
      console.log(`[OK] Remote path exists: ${remoteBackend}`);
      const list = await client.list();
      console.log(`[FILES] Found ${list.length} item(s) in ${remoteBackend}:`);
      list.slice(0, 10).forEach((item) => {
        console.log(`   ${item.isDirectory ? '[DIR] ' : '[FILE]'} ${item.name} (${item.size} bytes)`);
      });
      if (list.length > 10) {
        console.log(`   ... and ${list.length - 10} more items.`);
      }
    } catch (err) {
      console.warn(`[WARN] Could not cd to ${remoteBackend}: ${err.message}`);
    }
  } finally {
    client.close();
  }
}

async function deployBackend(env, isDryRun = false, recentHours = null) {
  const backendDir = path.join(ROOT_DIR, 'backend');
  const remoteRoot = env.REMOTE_BACKEND_ROOT || '/public_html';

  console.log(`\n========================================`);
  console.log(`[BACKEND SYNC] Scanning backend changes...${recentHours ? ` (Last ${recentHours}h)` : ''}`);
  console.log(`========================================`);

  const ignoreList = [
    'system',
    'vendor',
    'sql',
    'tests',
    'tools',
    'cgi-bin',
    '.git',
    'node_modules',
    /\.sql$/,
    /\.txt$/,
    /\.log$/,
    /\.py$/
  ];

  let files = scanDirectory(backendDir, backendDir, ignoreList);
  if (recentHours) {
    const cutoff = Date.now() - (recentHours * 60 * 60 * 1000);
    files = files.filter(f => f.mtime >= cutoff);
  }

  const cache = loadCache();
  const modified = [];

  for (const f of files) {
    const hash = getFileHash(f.fullPath);
    if (!cache.backend || cache.backend[f.relPath] !== hash) {
      modified.push({ ...f, hash });
    }
  }

  if (modified.length === 0) {
    console.log('[UP TO DATE] All backend files are in sync with the server. Nothing to upload.');
    return;
  }

  console.log(`[CHANGED] Found ${modified.length} modified file(s) to upload:\n`);
  modified.forEach((f) => {
    console.log(`  ↑ ${f.relPath} (${(f.size / 1024).toFixed(1)} KB)`);
  });

  if (isDryRun) {
    console.log('\n[DRY-RUN] Preview complete. No files were uploaded.');
    return;
  }

  const client = await getConnectedClient(env, false);
  try {
    if (!cache.backend) cache.backend = {};
    let count = 0;

    for (const f of modified) {
      const remoteFilePath = `${remoteRoot}/${f.relPath}`.replace(/\/+/g, '/');
      const remoteDir = path.posix.dirname(remoteFilePath);

      process.stdout.write(`Uploading (${++count}/${modified.length}): ${f.relPath}... `);
      await client.ensureDir(remoteDir);
      await client.uploadFrom(f.fullPath, remoteFilePath);
      console.log('✔ Done');

      cache.backend[f.relPath] = f.hash;
    }

    saveCache(cache);
    console.log(`\n[SUCCESS] Successfully uploaded ${modified.length} backend file(s)!`);
  } finally {
    client.close();
  }
}

async function deployFrontend(env, isDryRun = false) {
  const frontendDir = path.join(ROOT_DIR, 'frontend');
  const distDir = path.join(frontendDir, 'dist');
  const remoteRoot = env.REMOTE_FRONTEND_ROOT || '/public_html';

  console.log(`\n========================================`);
  console.log(`[FRONTEND SYNC] Building & uploading frontend...`);
  console.log(`========================================`);

  if (!isDryRun) {
    console.log('[BUILD] Running Vite production build (with 4GB memory allocation)...');
    try {
      execSync('npx --node-options="--max-old-space-size=4096" vite build', {
        cwd: frontendDir,
        stdio: 'inherit'
      });
      console.log('[BUILD] Build completed successfully in frontend/dist/');
    } catch (e) {
      console.error('[BUILD ERROR] Vite build failed. Halting deployment.');
      return;
    }
  }

  if (!fs.existsSync(distDir)) {
    console.error(`[ERROR] Dist directory not found at ${distDir}`);
    return;
  }

  const files = scanDirectory(distDir, distDir, []);
  console.log(`[SYNC] Found ${files.length} built asset(s) to synchronize.`);

  if (isDryRun) {
    console.log('[DRY-RUN] Preview complete. No files uploaded.');
    return;
  }

  const client = await getConnectedClient(env, false);
  try {
    console.log(`[UPLOAD] Uploading dist/ directly to ${remoteRoot}...`);
    await client.ensureDir(remoteRoot);
    await client.uploadFromDir(distDir, remoteRoot);
    console.log(`[SUCCESS] Frontend assets deployed successfully!`);
  } finally {
    client.close();
  }
}

async function uploadSingleFile(env, relativePath) {
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[ERROR] File does not exist: ${fullPath}`);
    return;
  }

  const relFromBackend = path.relative(path.join(ROOT_DIR, 'backend'), fullPath).replace(/\\/g, '/');
  const remoteRoot = env.REMOTE_BACKEND_ROOT || '/public_html';
  const remoteFilePath = `${remoteRoot}/${relFromBackend}`.replace(/\/+/g, '/');
  const remoteDir = path.posix.dirname(remoteFilePath);

  console.log(`[UPLOAD] Uploading single file:`);
  console.log(`   Local:  ${fullPath}`);
  console.log(`   Remote: ${remoteFilePath}`);

  const client = await getConnectedClient(env, false);
  try {
    await client.ensureDir(remoteDir);
    await client.uploadFrom(fullPath, remoteFilePath);
    console.log(`[SUCCESS] Upload complete!`);

    // Update cache
    const cache = loadCache();
    if (!cache.backend) cache.backend = {};
    cache.backend[relFromBackend] = getFileHash(fullPath);
    saveCache(cache);
  } finally {
    client.close();
  }
}

async function markAllSynced() {
  const backendDir = path.join(ROOT_DIR, 'backend');
  const ignoreList = ['system', 'vendor', 'sql', 'tests', 'tools', 'cgi-bin', '.git', 'node_modules', /\.sql$/, /\.txt$/, /\.log$/, /\.py$/];
  const files = scanDirectory(backendDir, backendDir, ignoreList);
  const cache = loadCache();
  if (!cache.backend) cache.backend = {};
  for (const f of files) {
    cache.backend[f.relPath] = getFileHash(f.fullPath);
  }
  saveCache(cache);
  console.log(`[SYNC CACHE] Marked ${files.length} backend files as currently synchronized with server.`);
}

// -----------------------------------------------------------------------------
// 5. CLI RUNNER
// -----------------------------------------------------------------------------
async function main() {
  ensureGitignore();
  const env = loadEnv();
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  let recentHours = null;
  const recentIdx = args.indexOf('--recent');
  if (recentIdx !== -1) {
    recentHours = parseFloat(args[recentIdx + 1]) || 24;
  }

  try {
    if (args.includes('--test')) {
      await testConnection(env);
    } else if (args.includes('--mark-synced')) {
      await markAllSynced();
    } else if (args.includes('--backend')) {
      await deployBackend(env, isDryRun, recentHours);
    } else if (args.includes('--frontend')) {
      await deployFrontend(env, isDryRun);
    } else if (args.includes('--all')) {
      await deployBackend(env, isDryRun, recentHours);
      await deployFrontend(env, isDryRun);
    } else if (args.includes('--file')) {
      const fileIdx = args.indexOf('--file');
      if (fileIdx !== -1 && args[fileIdx + 1]) {
        await uploadSingleFile(env, args[fileIdx + 1]);
      } else {
        console.error('[ERROR] Please specify a file path: node deploy.js --file path/to/file.php');
      }
    } else {
      console.log(`
Maslaha cPanel Automated Deployment Tool
=========================================
Commands:
  node deploy.js --test                 Test FTP connection & verify remote folder
  node deploy.js --backend              Upload only changed PHP files in backend/
  node deploy.js --backend --recent 24  Upload only files modified in last 24 hours
  node deploy.js --file <path>          Upload a specific single file immediately
  node deploy.js --frontend             Build React app (4GB memory) and upload dist/
  node deploy.js --all                  Deploy both backend & frontend
  node deploy.js --dry-run              Preview which files would be uploaded
  node deploy.js --mark-synced          Mark all current files as synced in cache

Configuration file:
  .deploy.env (stores your FTP host, user, and password)
`);
    }
  } catch (err) {
    console.error('\n[DEPLOY ERROR]', err.message);
    process.exit(1);
  }
}

main();
