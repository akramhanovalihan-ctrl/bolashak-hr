const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadProjectEnv(rootDir) {
  const root = rootDir || path.join(__dirname, '..');
  const bot = parseEnvFile(path.join(root, 'bot', '.env'));
  const server = parseEnvFile(path.join(root, 'server', '.env'));
  return { ...bot, ...server };
}

module.exports = { parseEnvFile, loadProjectEnv };
