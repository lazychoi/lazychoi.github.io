/**
 * build_dict.js
 *
 * 사용법:
 *   node build_dict.js
 *
 * data/ 폴더의 모든 .txt 파일을 읽어서
 * data/hanja_dict.json 하나로 합칩니다.
 *
 * txt 파일을 수정한 뒤 이 스크립트를 실행하면
 * hanja_dict.json이 최신 상태로 업데이트됩니다.
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const outputPath = path.join(dataDir, 'hanja_dict.json');

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));
console.log(`총 ${files.length}개의 txt 파일을 처리합니다...`);

// { korean: { hanja: meaning, ... }, ... }
const dict = {};

for (const file of files) {
  const filePath = path.join(dataDir, file);
  const buffer = fs.readFileSync(filePath);

  // UTF-16LE BOM 감지
  let text;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.toString('utf16le');
  } else {
    text = buffer.toString('utf8');
  }

  let count = 0;
  for (const line of text.split('\n')) {
    const parts = line.trim().split('|');
    if (parts.length >= 2) {
      const korean = parts[0];
      const hanja  = parts[1];
      const meaning = parts[2] || '';

      if (!dict[korean]) dict[korean] = {};
      dict[korean][hanja] = meaning;
      count++;
    }
  }
  console.log(`  ✓ ${file}: ${count}개 항목`);
}

fs.writeFileSync(outputPath, JSON.stringify(dict), 'utf-8');
console.log(`\n완료! → data/hanja_dict.json (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)} MB)`);
