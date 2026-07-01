const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Running npm run lint...");
  const lintOut = execSync('npm run lint', { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('lint_output.txt', lintOut);
} catch (e) {
  fs.writeFileSync('lint_output.txt', e.stdout + '\n' + e.stderr);
}

try {
  console.log("Running npm run build...");
  const buildOut = execSync('npm run build', { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('build_output.txt', buildOut);
} catch (e) {
  fs.writeFileSync('build_output.txt', e.stdout + '\n' + e.stderr);
}
