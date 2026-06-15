import fs from 'fs';

const p = 'server/src/routes/documents.js';
let s = fs.readFileSync(p, 'utf8');
const bad = 'status(' + [4, 4, 1].join('') + ')';
const good = 'status(' + [4, 0, 4].join('') + ')';
console.log('replace', bad, '->', good);
s = s.split(bad).join(good);
fs.writeFileSync(p, s);
console.log([...new Set(s.match(/status\(\d+\)/g))]);
