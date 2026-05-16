const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const manifestPath = path.join(dataDir, 'manifest.json');

if (fs.existsSync(dataDir)) {
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.txt'));
  
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2), 'utf-8');
  console.log(`Successfully generated manifest.json with ${files.length} files.`);
} else {
  console.error('Data directory does not exist.');
}
