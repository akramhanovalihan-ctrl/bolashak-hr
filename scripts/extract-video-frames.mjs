import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;

const videoDir = process.argv[2] || path.join(__dirname, '../видео');
const outDir = process.argv[3] || path.join(__dirname, '../docs/assets/chat/2026-06-18');
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(videoDir).filter((f) => f.endsWith('.mp4'))) {
  const input = path.join(videoDir, file);
  const base = file.replace(/\.mp4$/i, '').replace(/[^\w\-]+/g, '_').slice(0, 50);
  const pattern = path.join(outDir, `${base}_%02d.jpg`);
  console.log('Extracting:', file);
  execFileSync(ffmpeg, [
    '-y', '-i', input,
    '-vf', 'fps=1/10',
    '-frames:v', '12',
    pattern,
  ], { stdio: 'inherit' });
}

console.log('Done ->', outDir);
