const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  execSync('unzip -o /tmp_repo/src.zip -d /tmp_repo', { stdio: 'inherit' });
  execSync('unzip -o /tmp_repo/public.zip -d /tmp_repo', { stdio: 'inherit' });
  console.log("Extracted successfully using native unzip.");
} catch(e) {
  console.error("Error with native unzip, falling back:", e);
}
