// `pnpm deploy:dev`: deploys the test Worker with the values in .env, through
// a generated Wrangler configuration that is never committed. Run by the
// maintainer only.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { baseConfigFromToml, devDeployConfig } from './deploy-dev-args.ts';

// Inside .wrangler/ (git-ignored). Wrangler resolves `main` against this
// file's directory, hence the `../` below.
const CONFIG_DIR = '.wrangler/dev-deploy';
const CONFIG_PATH = `${CONFIG_DIR}/wrangler.json`;

if (!existsSync('.env')) {
    console.error('No .env file; copy .env.dev.example to .env and fill it in.');
    process.exit(1);
}
process.loadEnvFile('.env');

const base = baseConfigFromToml(readFileSync('wrangler.toml', 'utf8'));
if (!base) {
    console.error('wrangler.toml lacks main or compatibility_date.');
    process.exit(1);
}

const result = devDeployConfig(process.env, { ...base, main: `../../${base.main}` });
if (!result.ok) {
    console.error(`Not deploying:\n- ${result.problems.join('\n- ')}`);
    process.exit(1);
}

for (const warning of result.warnings) console.warn(`Warning: ${warning}`);

mkdirSync(CONFIG_DIR, { recursive: true });
writeFileSync(CONFIG_PATH, JSON.stringify(result.config, null, 2) + '\n');
console.log(`Deploying ${result.config.name} to ${result.config.routes.map((route) => route.pattern).join(', ')}`);

const run = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--config', CONFIG_PATH], { stdio: 'inherit' });
process.exit(run.status ?? 1);
