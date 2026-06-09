import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { closePool, getPool } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const driver = process.env.DB_DRIVER || 'mssql';

async function init() {
  if (driver === 'sqlite') {
    const schema = fs.readFileSync(path.join(__dirname, 'schema-sqlite.sql'), 'utf8');
    const db = getPool();
    db.exec(schema);
    db.exec(fs.readFileSync(path.join(__dirname, 'schema-modules.sql'), 'utf8'));
    console.log('Database schema initialized — SQLite');
  } else {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const batches = schema
      .split(/\r?\nGO\r?\n/i)
      .map((batch) => batch.trim())
      .filter(Boolean);

    const pool = await getPool();
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    const modBatches = fs.readFileSync(path.join(__dirname, 'schema-modules-mssql.sql'), 'utf8')
      .split(/\r?\nGO\r?\n/i).map((b) => b.trim()).filter(Boolean);
    for (const batch of modBatches) {
      await pool.request().query(batch);
    }
    console.log('Database schema initialized — SQL Server');
  }

  await closePool();
}

init().catch((err) => {
  console.error('DB init failed:', err.message || err);
  process.exit(1);
});
