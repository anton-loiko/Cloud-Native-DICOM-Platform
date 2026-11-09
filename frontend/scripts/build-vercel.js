/**
 * Vercel Build Script for Angular SPA
 * 1. Executes set-env.js to sync environment variables into files
 * 2. Runs production ng build
 */
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

// 1. Sync environments & vercel.json
require('./set-env');

// 2. Run production ng build
console.log('📦 [Vercel Build] Compiling Angular bundle...');
execSync('npx ng build', { stdio: 'inherit', cwd: rootDir });
