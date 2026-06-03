const fs = require('fs');
const path = require('path');

const dataDir = '/Users/jun/Documents/lazychoi.github.io/data';
const manifestPath = path.join(dataDir, 'manifest.json');
const tablePath = path.join(__dirname, 'node_modules/@seyoungsong/hanjadict/data/table.json');

const files = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

// Extract all unique pairs from txt files
const pairs = new Set();
const pairList = [];

for (const file of files) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) continue;

  const buffer = fs.readFileSync(filePath);
  let text;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.toString('utf16le');
  } else {
    text = buffer.toString('utf8');
  }

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

console.log(`Total unique single-character pairs: ${pairList.length}`);

// Function to extract meaning
function getMeaning(hangul, hanja) {
  const raw = table[hanja];
  if (!raw) return null;

  // Split by comma first
  const groups = raw.split(',');
  const matchedItems = [];

  for (const group of groups) {
    // Split by slash
    const items = group.split('/');
    for (const item of items) {
      const trimmed = item.trim();
      if (trimmed.endsWith(hangul)) {
        matchedItems.push(trimmed);
      }
    }
  }

  if (matchedItems.length > 0) {
    return matchedItems.join(', ');
  }
  return null;
}

let foundInDictCount = 0;
let foundWithMeaningCount = 0;
let missingInDictCount = 0;
const missingChars = [];

for (const pair of pairList) {
  const meaning = getMeaning(pair.hangul, pair.hanja);
  if (meaning) {
    foundWithMeaningCount++;
  }
  if (table[pair.hanja]) {
    foundInDictCount++;
  } else {
    missingInDictCount++;
    missingChars.push(pair);
  }
}

console.log(`Hanja characters found in table.json: ${foundInDictCount}`);
console.log(`Hanja characters found with pronunciation-matched meaning: ${foundWithMeaningCount}`);
console.log(`Hanja characters missing from table.json: ${missingInDictCount}`);
console.log(`Example missing characters (first 10):`);
console.log(missingChars.slice(0, 10));
