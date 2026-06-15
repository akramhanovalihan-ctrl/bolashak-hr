import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../server/package.json'));
const sql = require('mssql');

function loadEnv() {
  const env = {};
  const file = path.join(__dirname, '../server/.env');
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const backupDir = env.BACKUP_DIR || 'C:\\BolashakHR\\backups';
const retentionDays = Number(env.BACKUP_RETENTION_DAYS || 14);
const serverHost = env.SQLSERVER_HOST || 'localhost\\SQLEXPRESS';
const host = serverHost.includes('\\') ? serverHost.split('\\')[0] : serverHost;

const config = {
  server: host,
  database: env.SQLSERVER_DATABASE || 'bolashak_hr',
  user: env.SQLSERVER_USER || 'sa',
  password: env.SQLSERVER_PASSWORD || '',
  options: {
    encrypt: env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: env.SQLSERVER_TRUST_CERT !== 'false',
    instanceName: serverHost.includes('\\') ? serverHost.split('\\')[1] : undefined,
    enableArithAbort: true,
  },
};

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bakPath = path.join(backupDir, `bolashak_hr_${stamp}.bak`);

const pool = await sql.connect(config);
try {
  await pool.request().query(`
    BACKUP DATABASE [${config.database}]
    TO DISK = N'${bakPath.replace(/'/g, "''")}'
    WITH INIT, CHECKSUM, STATS = 10
  `);
  console.log('Backup OK:', bakPath);

  const cutoff = Date.now() - retentionDays * 86400000;
  for (const file of fs.readdirSync(backupDir)) {
    if (!file.startsWith('bolashak_hr_') || !file.endsWith('.bak')) continue;
    const full = path.join(backupDir, file);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      console.log('Removed old backup:', file);
    }
  }
} finally {
  await pool.close();
}
