// The Deploy to Cloudflare button prompts for every variable in a
// `.env.example` or `.dev.vars.example`; a one-click deploy needs none, so
// neither file may exist. The test deployment's template documents every
// runtime variable instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_KEYS } from '../src/options.ts';

const root = join(import.meta.dirname, '..');

test('no file makes the deploy button ask for variables', () => {
    for (const name of ['.env.example', '.dev.vars.example']) {
        assert.equal(existsSync(join(root, name)), false, name);
    }
});

test('the test deployment template lists every runtime variable', () => {
    const template = readFileSync(join(root, '.env.dev.example'), 'utf8');
    for (const key of Object.values(ENV_KEYS)) assert.match(template, new RegExp(`^${key}=`, 'm'), key);
});
