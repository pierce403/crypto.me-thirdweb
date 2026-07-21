const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, '.open-next');

if (!fs.existsSync(outputRoot)) {
  console.error('OpenNext output is missing; run the Cloudflare build first.');
  process.exit(1);
}

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

function localEnvFiles() {
  return fs.readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\.env(?:\..+)?$/.test(entry.name))
    .filter((entry) => !entry.name.endsWith('.example'))
    .map((entry) => path.join(projectRoot, entry.name));
}

function secretValuesByKey() {
  const secrets = new Map();
  for (const envPath of localEnvFiles()) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Ignore ordinary short settings; credentials and connection strings are
      // long enough for this to avoid noisy false positives.
      if (value.length >= 8) secrets.set(match[1], value);
    }
  }
  return secrets;
}

const compiledEnvPath = path.join(outputRoot, 'cloudflare', 'next-env.mjs');
fs.mkdirSync(path.dirname(compiledEnvPath), { recursive: true });
fs.writeFileSync(
  compiledEnvPath,
  'export const production = {};\nexport const development = {};\nexport const test = {};\n',
);

for (const filePath of walkFiles(outputRoot)) {
  if (/^\.env(?:\..+)?$/.test(path.basename(filePath))) {
    fs.rmSync(filePath);
  }
}

const outputFiles = walkFiles(outputRoot);
const leaks = [];
for (const [key, value] of secretValuesByKey()) {
  if (outputFiles.some((filePath) => fs.readFileSync(filePath).includes(Buffer.from(value)))) {
    leaks.push(key);
  }
}

if (leaks.length > 0) {
  console.error(`Refusing to deploy: OpenNext output contains local values for ${leaks.join(', ')}`);
  process.exit(1);
}

console.log('OpenNext environment output sanitized and verified.');
