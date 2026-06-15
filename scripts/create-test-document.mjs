const base = 'https://exquisite-quietude-production-c3c1.up.railway.app/api/hr';
const fs = await import('fs');
const path = await import('path');
const { fileURLToPath } = await import('url');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'test-document.txt');

const loginRes = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'aizada@bolashak.local', password: 'admin123', remember: true }),
});
const loginData = await loginRes.json();
if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');
const cookie = loginRes.headers.getSetCookie?.()?.[0]?.split(';')[0];
if (!cookie) throw new Error('No session cookie');

const createRes = await fetch(`${base}/documents`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({
    doc_type: 'order',
    title: 'ТЕСТ: Приказ о проверке документов',
    content: `Тестовый приказ от ${new Date().toLocaleString('ru-RU')}. Проверка загрузки файлов и публикации.`,
    visibility: { mode: 'all' },
  }),
});
const created = await createRes.json();
if (!createRes.ok) throw new Error(created.error || 'Create failed');
console.log('Document id:', created.id);

const fd = new FormData();
const blob = new Blob([fs.readFileSync(filePath)], { type: 'text/plain' });
fd.append('file', blob, 'test-document.txt');

const uploadRes = await fetch(`${base}/documents/${created.id}/file`, {
  method: 'PUT',
  headers: { Cookie: cookie },
  body: fd,
});
const uploadData = await uploadRes.json();
if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
console.log('Uploaded:', uploadData.file_name);

const pubRes = await fetch(`${base}/documents/${created.id}/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ visibility: { mode: 'all' } }),
});
const pubData = await pubRes.json();
if (!pubRes.ok) throw new Error(pubData.error || 'Publish failed');
console.log('Published: ok');
console.log('URL: https://exquisite-quietude-production-c3c1.up.railway.app/documents');
