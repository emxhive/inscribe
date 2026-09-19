const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      const ext = path.extname(file);
      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const rootDir = path.resolve(__dirname, '..');
const targets = [
  path.join(rootDir, 'packages'),
  path.join(rootDir, 'apps')
];

let filesToCheck = [];
targets.forEach(target => {
  if (fs.existsSync(target)) {
    filesToCheck = filesToCheck.concat(walk(target));
  }
});

// Scan only packages/*/src/** and apps/*/src/**, excluding legacy directories
filesToCheck = filesToCheck.filter(file => {
  const relative = path.relative(rootDir, file);
  const parts = relative.split(path.sep);
  
  if (parts.includes('legacy')) {
    return false;
  }
  
  if (parts.length < 3) {
    return false;
  }
  
  return (parts[0] === 'packages' || parts[0] === 'apps') && parts[2] === 'src';
});

// Detect imports that cross an actual `legacy/` path segment. A component such
// as `LegacyHistoryReviewPanel` is active code and must not be treated as a
// legacy-directory import merely because its name contains the same word.
const importRegex = /(?:import|from|require)\s*\(?\s*['"`]([^'"`]*)['"`]/i;
const legacyPathSegmentRegex = /(?:^|[\\/])legacy(?:[\\/]|$)/i;

let violations = 0;

filesToCheck.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const importMatch = importRegex.exec(line);
    if (importMatch && legacyPathSegmentRegex.test(importMatch[1])) {
      console.error(`Violation: Legacy import found in ${path.relative(rootDir, file)} on line ${idx + 1}:`);
      console.error(`  > ${line.trim()}`);
      violations++;
    }
  });
});

if (violations > 0) {
  console.error(`\nFound ${violations} legacy import violation(s).`);
  process.exit(1);
} else {
  console.log('Check passed: No legacy imports found in active source directories.');
  process.exit(0);
}
