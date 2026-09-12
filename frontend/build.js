import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting frontend build on Vercel...');

execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });

console.log('Vercel frontend build completed successfully.');
