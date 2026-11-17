import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['build', 'deploy'].includes(mode)) {
  throw new Error('Usage: node scripts/cloudflare.mjs <build|deploy>');
}

// This public manifest is available in a clean Git checkout. Credentials stay
// in Workers secrets or optional gitignored production env files.
const config = JSON.parse(
  readFileSync(resolve(root, 'cloudflare/production.json'), 'utf8')
);
config.$schema = 'node_modules/wrangler/config-schema.json';
writeFileSync(
  resolve(root, 'wrangler.jsonc'),
  JSON.stringify(config, null, 2) + '\n'
);

const env = { ...process.env };
for (const name of ['.env.production.local', '.env.production']) {
  const path = resolve(root, name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/
    );
    if (!match || env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    env[match[1]] = value;
  }
}
Object.assign(env, config.vars, {
  NODE_ENV: 'production',
  NITRO_PRESET: 'cloudflare_module',
});

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ['scripts/db-setup.mjs']);
run('pnpm', ['exec', 'vite', 'build']);
if (mode === 'deploy') run('pnpm', ['exec', 'wrangler', 'deploy']);
