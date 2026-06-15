import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const driver = process.env.DB_DRIVER || 'mssql';

if (driver === 'sqlite') {
  const dbPath = path.resolve(
    process.env.SQLITE_PATH || path.join(__dirname, '../data/bolashak_hr.db')
  );
  const dataDir = path.dirname(dbPath);

  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.log(`[bolashak-hr] Volume mounted at ${process.env.RAILWAY_VOLUME_MOUNT_PATH}`);
  }
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
} else {
  const host = process.env.SQLSERVER_HOST || 'localhost\\SQLEXPRESS';
  const database = process.env.SQLSERVER_DATABASE || 'bolashak_hr';
  console.log(`[bolashak-hr] SQL Server: ${host} / ${database}`);
}

await import('./index.js');
