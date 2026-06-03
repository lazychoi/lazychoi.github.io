const fs = require('fs');
const path = require('path');

const dataDir = '/Users/jun/Documents/lazychoi.github.io/data';
const manifestPath = path.join(dataDir, 'manifest.json');
const tablePath = path.join(__dirname, 'node_modules/@seyoungsong/hanjadict/data/table.json');

const files = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

const pairs = new Set();
const pairList = [];

for (const file of files) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) continue;

  const buffer = fs.readFileSync(filePath);
  let text = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.toString('utf16le') : buffer.toString('utf8');

  for (const line of text.split('\n')) {
    const parts = line.trim().split('|');
    if (parts.length >= 2) {
      const hangul = parts[0];
      const hanja = parts[1];
      if (hangul.length === 1 && hanja.length === 1) {
        const key = `${hangul}|${hanja}`;
        if (!pairs.has(key)) {
          pairs.add(key);
          pairList.push({ hangul, hanja, file, existingMeaning: parts[2] || '' });
        }
      }
    }
  }
}

function getMeaning(hangul, hanja) {
  const raw = table[hanja];
  if (!raw) return null;
  const groups = raw.split(',');
  const matchedItems = [];
  for (const group of groups) {
    const items = group.split('/');
    for (const item of items) {
      const trimmed = item.trim();
      if (trimmed.endsWith(hangul)) {
        matchedItems.push(trimmed);
      }
    }
  }
  return matchedItems.length > 0 ? matchedItems.join(', ') : null;
}

const mismatches = [];
for (const pair of pairList) {
  if (table[pair.hanja] && !getMeaning(pair.hangul, pair.hanja)) {
    mismatches.push({
      hangul: pair.hangul,
      hanja: pair.hanja,
      raw: table[pair.hanja]
    });
  }
}

console.log(`Total mismatches: ${mismatches.length}`);
console.log("Example mismatches (first 20):");
console.log(mismatches.slice(0, 20));
