import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/bolashak_hr.db');

let db = null;

export function getPool() {
  if (!db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function normalizeSql(text) {
  let sqlText = text;

  for (let i = 20; i >= 1; i--) {
    sqlText = sqlText.replace(new RegExp(`\\$${i}(?:::[\\w.]+)?`, 'g'), '?');
  }

  sqlText = sqlText
    .replace(/OUTPUT INSERTED\.\*/gi, 'RETURNING *')
    .replace(/SYSUTCDATETIME\(\)/gi, "datetime('now')")
    .replace(/MERGE hr\.hr_users[\s\S]*?OUTPUT INSERTED\.id, INSERTED\.email;/gi, '')
    .replace(/MERGE hr\.hr_units[\s\S]*?OUTPUT INSERTED\.id, INSERTED\.code;/gi, '');

  return sqlText;
}

export async function query(text, params = []) {
  const database = getPool();
  const sqlText = normalizeSql(text).trim();
  const stmt = database.prepare(sqlText);

  const isSelect = /^SELECT/i.test(sqlText) || /^WITH/i.test(sqlText);
  const isReturning = /RETURNING/i.test(sqlText);

  if (isSelect) {
    return { rows: stmt.all(...params) };
  }

  if (isReturning) {
    return { rows: stmt.all(...params) };
  }

  const info = stmt.run(...params);
  return { rows: [], info };
}

export async function closePool() {
  if (db) {
    db.close();
    db = null;
  }
}

export const sql = null;
