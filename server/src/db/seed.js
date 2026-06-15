import { importOrgData } from './import-org.js';
import { closePool } from './index.js';

async function seed() {
  await importOrgData();
  console.log('Demo logins: aizada@bolashak.local / admin123');
  await closePool();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
