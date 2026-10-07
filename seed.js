/**
 * Database Seed Runner for Marlow Dental Clinic
 * 
 * Invokes the backend's idempotent SQLAlchemy seeder (app.cli seed) to populate
 * local PostgreSQL with all development entities:
 *  - Organization & Multi-Location Practice branches
 *  - Clinical Team Members (Doctors & Specialists)
 *  - Diagnostic & Treatment Services
 *  - Ticker Announcements
 *  - CMS Site Sections (Hero, Commitments, Statistics, Values, etc.)
 *  - FAQs & Social Links
 *  - Platform Roles & RBAC
 *
 * Usage:
 *   node seed.js
 *   npm run seed (from frontend/)
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.resolve(__dirname, 'backend');

// Detect available python binary
const candidates = [
  path.join(backendDir, '.venv', 'Scripts', 'python.exe'),
  path.join(backendDir, '.venv', 'bin', 'python'),
  path.join(backendDir, 'venv', 'Scripts', 'python.exe'),
  path.join(backendDir, 'venv', 'bin', 'python'),
  'python',
  'py',
  'python3'
];

let pythonBin = null;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    pythonBin = cand;
    break;
  }
}

if (!pythonBin) {
  pythonBin = process.platform === 'win32' ? 'py' : 'python3';
}

console.log(`[seed.js] Running database seeder via ${pythonBin} in ${backendDir}...`);

const result = spawnSync(pythonBin, ['-m', 'app.cli', 'seed'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
  env: process.env
});

if (result.error) {
  console.error('[seed.js] Error running seed script:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`[seed.js] Seed script exited with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log('[seed.js] Database seeding completed successfully.');
