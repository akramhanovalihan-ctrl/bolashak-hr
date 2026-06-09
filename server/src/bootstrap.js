import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(
  process.env.SQLITE_PATH || path.join(__dirname, '../data/bolashak_hr.db')
);

if (!fs.existsSync(dbPath)) {
  console.log('First run — initializing database...');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  execSync('node src/db/create-db.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  execSync('node src/db/init.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  execSync('node src/db/seed.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

await import('./index.js');
