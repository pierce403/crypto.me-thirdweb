const { spawnSync } = require('node:child_process');

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL_NO_SSL ??
    null
  );
}

const databaseUrl = resolveDatabaseUrl();
if (!process.env.DATABASE_URL && databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  // eslint-disable-next-line no-console
  console.error('Usage: node scripts/with-database-url.js <command> [args...]');
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);

