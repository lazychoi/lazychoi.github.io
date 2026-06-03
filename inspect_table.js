const fs = require('fs');
const path = require('path');

const tablePath = path.join(__dirname, 'node_modules/@seyoungsong/hanjadict/data/table.json');
const table = JSON.parse(fs.readFileSync(tablePath, 'utf8'));

console.log("學 ->", table["學"]);
console.log("快 ->", table["快"]);
console.log("Type of table keys:", typeof Object.keys(table)[0]);
console.log("Total entries in table.json:", Object.keys(table).length);
