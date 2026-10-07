/**
 * Frontend Database Seed Proxy
 * 
 * Invokes the root seed script to populate PostgreSQL from frontend context.
 * Usage:
 *   npm run seed
 */

const { spawnSync } = require('child_process');
const path = require('path');

const rootSeed = path.resolve(__dirname, '..', 'seed.js');

const result = spawnSync(process.execPath, [rootSeed], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: false,
  env: process.env
});

process.exit(result.status || 0);
