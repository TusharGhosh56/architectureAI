import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting frontend build on Vercel...');

execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });

const builtDist = path.join(__dirname, 'dist');

if (fs.existsSync(builtDist)) {
  const targetDirs = [
    path.resolve(__dirname, 'dist'),
    path.resolve(__dirname, '..', 'dist'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(process.cwd(), 'frontend', 'dist'),
    path.resolve(__dirname, '..', 'backend', 'dist'),
    path.resolve(__dirname, '..', 'backend', 'app', 'dist'),
    path.resolve(__dirname, '..', 'backend', 'frontend', 'dist'),
    path.resolve(__dirname, '..', 'app', 'dist'),
  ];

  for (const target of targetDirs) {
    if (path.resolve(target) !== path.resolve(builtDist)) {
      try {
        fs.mkdirSync(target, { recursive: true });
        fs.cpSync(builtDist, target, { recursive: true });
        console.log(`Synced dist -> ${target}`);
      } catch (err) {
        console.warn('Notice: Could not sync dist to', target, err.message);
      }
    }
  }
}

console.log('Vercel frontend build completed successfully.');
