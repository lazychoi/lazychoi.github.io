const fs = require('fs');
const path = require('path');

const tablePath = path.join(__dirname, 'node_modules/@seyoungsong/hanjadict/data/table.json');
const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

const keys = ['學', '快', '價', '監', '乾', '艮', '價', '呵', '賈'];
keys.forEach(k => {
  console.log(`${k} -> ${table[k]}`);
});
