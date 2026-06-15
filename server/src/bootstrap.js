import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbPath = path.resolve(
  process.env.SQLITE_PATH || path.join(__dirname, '../data/bolashak_hr.db')
);
const dataDir = path.dirname(dbPath);

console.log(`[bolashak-hr] SQLite: ${dbPath}`);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  console.log('First run — initializing database...');
  execSync('node src/db/create-db.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  execSync('node src/db/init.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  execSync('node src/db/seed.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

await import('./index.js');
