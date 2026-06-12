import fs from 'fs';
import path from 'path';

export function getUploadsDir() {
  const sqlite = process.env.SQLITE_PATH || './data/bolashak_hr.db';
  const dataDir = path.dirname(path.resolve(sqlite));
  const uploads = path.join(dataDir, 'uploads');
  if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
  return uploads;
}

export function storedFileName(docId, originalName) {
  const ext = path.extname(originalName || '').toLowerCase().slice(0, 10);
  return `${docId}${ext || '.bin'}`;
}

export function storedFilePath(docId, originalName) {
  return path.join(getUploadsDir(), storedFileName(docId, originalName));
}
