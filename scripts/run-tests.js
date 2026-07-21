const fs = require('node:fs');
const path = require('node:path');

function findTestFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTestFiles(entryPath);
      return entry.name.endsWith('.test.ts') ? [entryPath] : [];
    })
    .sort();
}

for (const testFile of findTestFiles(path.join(process.cwd(), 'tests'))) {
  require(testFile);
}
