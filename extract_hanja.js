const { execSync } = require('child_process');

try {
  console.log("Installing @seyoungsong/hanjadict locally...");
  execSync("npm install --no-save @seyoungsong/hanjadict", { stdio: 'inherit' });
  console.log("Successfully installed.");

  const { lookup, isHanja } = require('@seyoungsong/hanjadict');
  
  // Test lookup
  console.log("學 ->", lookup("學"));
  console.log("快 ->", lookup("快"));
  console.log("价 ->", lookup("价"));
} catch (e) {
  console.error("Error:", e);
}
