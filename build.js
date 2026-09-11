const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Locate frontend directory whether running from repo root or backend
let frontendDir = path.resolve(__dirname, 'frontend');
if (!fs.existsSync(frontendDir)) {
  frontendDir = path.resolve(__dirname, '..', 'frontend');
}

if (!fs.existsSync(frontendDir)) {
  console.error('Error: Frontend directory not found at:', frontendDir);
  process.exit(1);
}

console.log('Installing frontend dependencies in:', frontendDir);
execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });

console.log('Building frontend in:', frontendDir);
execSync('npm run build', { cwd: frontendDir, stdio: 'inherit' });

const builtDist = path.join(frontendDir, 'dist');

// Sync built dist to all possible Vercel output directories
const targetDirs = [
  path.resolve(__dirname, 'dist'),
  path.resolve(__dirname, 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'frontend', 'dist'),
  path.resolve(__dirname, '..', 'backend', 'frontend', 'dist'),
];

for (const target of targetDirs) {
  if (target !== builtDist) {
    try {
      fs.mkdirSync(target, { recursive: true });
      fs.cpSync(builtDist, target, { recursive: true });
    } catch (err) {
      console.warn('Notice: Could not sync dist to', target, err.message);
    }
  }
}

console.log('Build completed successfully.');
