import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { closePool, getPool } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const driver = process.env.DB_DRIVER || 'mssql';

async function createDatabase() {
  if (driver === 'sqlite') {
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/bolashak_hr.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    getPool();
    console.log(`SQLite database ready: ${dbPath}`);
    await closePool();
    return;
  }

  const sql = (await import('mssql')).default;
  const dbName = process.env.SQLSERVER_DATABASE || 'bolashak_hr';
  const serverHost = process.env.SQLSERVER_HOST || 'localhost\\SQLEXPRESS';

  const config = {
    server: serverHost.includes('\\') ? serverHost.split('\\')[0] : serverHost,
    port: Number(process.env.SQLSERVER_PORT || 1433),
    database: 'master',
    user: process.env.SQLSERVER_USER || 'sa',
    password: process.env.SQLSERVER_PASSWORD || '',
    options: {
      encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
      trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== 'false',
      instanceName: serverHost.includes('\\') ? serverHost.split('\\')[1] : undefined,
      enableArithAbort: true,
    },
  };

  const pool = await sql.connect(config);
  const { recordset } = await pool.request().query(
    `SELECT name FROM sys.databases WHERE name = '${dbName.replace(/'/g, "''")}'`
  );

  if (recordset.length === 0) {
    await pool.request().query(`CREATE DATABASE [${dbName.replace(/]/g, ']]')}]`);
    console.log(`Database "${dbName}" created`);
  } else {
    console.log(`Database "${dbName}" already exists`);
  }

  await pool.close();
}

createDatabase().catch((err) => {
  console.error('Create DB failed:', err.message || err);
  process.exit(1);
});
