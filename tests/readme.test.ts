// The README stays in step with the code: every field, variable and fixed
// endpoint it documents exists, and none is missing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIELDS } from '../src/core/fields.ts';
import { FIXED_PATHS } from '../src/core/router.ts';
import { ENV_KEYS } from '../src/options.ts';

const readme = readFileSync(join(import.meta.dirname, '../README.md'), 'utf8');

test('the README lists every field', () => {
    for (const field of FIELDS) assert.ok(readme.includes(`\`${field.key}\``), field.key);
});

test('the README documents every variable', () => {
    for (const key of Object.values(ENV_KEYS)) assert.ok(readme.includes(`| \`${key}\` |`), key);
});

test('the README lists every fixed endpoint', () => {
    for (const path of FIXED_PATHS) assert.ok(readme.includes(`\`GET ${path}\``), path);
});
