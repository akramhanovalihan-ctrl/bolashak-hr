import dotenv from 'dotenv';

dotenv.config();

const driver = process.env.DB_DRIVER || 'mssql';

const db = driver === 'sqlite'
  ? await import('./sqlite.js')
  : await import('./mssql.js');

export const query = db.query;
export const closePool = db.closePool;
export const getPool = db.getPool;
export const sql = db.sql;
