import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

process.env.DB_DRIVER = process.env.DB_DRIVER || 'mssql';
if (!process.env.SQLITE_PATH) {
  process.env.SQLITE_PATH = path.join(__dirname, '../../server/data/bolashak_hr.db');
} else if (!path.isAbsolute(process.env.SQLITE_PATH)) {
  process.env.SQLITE_PATH = path.resolve(path.join(__dirname, '..'), process.env.SQLITE_PATH);
}
