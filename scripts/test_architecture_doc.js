const fs = require('fs');
const path = require('path');

const archFile = path.join(__dirname, '../ARCHITECTURE.MD'); // Adjust path to ARCHITECTURE.MD

try {
  const content = fs.readFileSync(archFile, 'utf-8');
  let testsPassed = true;
  const errors = [];

  const checks = [
    { keyword: 'service_cache', label: 'Reference to service_cache table' },
    { keyword: 'fast-profile.ts', label: 'Reference to fast-profile.ts API' },
    { keyword: 'Aggregated Profile Page Loading Flow', label: 'Section on Aggregated Profile Page Loading Flow' },
    { keyword: 'expires_at', label: 'Mention of expires_at field for cache management' },
    { keyword: 'Database Layer', label: 'Database Layer section' }
  ];

  console.log('Running ARCHITECTURE.md checks...');
  checks.forEach(check => {
    if (!content.includes(check.keyword)) {
      errors.push(`Missing: ${check.label} (keyword: ${check.keyword})`);
      testsPassed = false;
    } else {
      console.log(`  ✅ Found: ${check.label}`);
    }
  });

  if (testsPassed) {
    console.log('\nARCHITECTURE.md checks passed!');
    process.exit(0);
  } else {
    console.error('\nARCHITECTURE.md checks failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
} catch (error) {
  console.error('Failed to read or test ARCHITECTURE.MD:', error);
  process.exit(1);
}
