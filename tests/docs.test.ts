// The generated docs: /help, /llms.txt and /openapi.json cover every field
// and every endpoint, and stay factual.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, fieldPath } from '../src/core/fields.ts';
import { renderHelp } from '../src/core/docs/help.ts';
import { renderLlmsTxt } from '../src/core/docs/llms.ts';
import { renderOpenApi } from '../src/core/docs/openapi.ts';
import { ERROR_CODES } from '../src/core/respond.ts';
import { FIXED_PATHS } from '../src/core/router.ts';

const bare = { host: 'probe.example.com', hosts: {} };
const split = { host: 'probe.example.com', hosts: { v4: 'probe-4.example.com', v6: 'probe-6.example.com' } };

// Words that would turn a fact into a verdict; the docs never use them.
const VERDICTS = /\b(leak|leaked|leaking|exposed|danger|dangerous|unsafe|insecure|compromised)\b/i;

test('/help stays under 40 lines and names every field', () => {
    const help = renderHelp(bare);
    assert.ok(help.endsWith('\n'));
    assert.ok(help.split('\n').length <= 41, `${help.split('\n').length} lines`);
    for (const field of FIELDS) assert.match(help, new RegExp(`\\b${fieldPath(field).slice(1)}\\b`), field.key);
    assert.ok(help.includes('curl probe.example.com/json'));
    assert.ok(help.includes('curl -4 probe.example.com'));
    assert.ok(help.includes('curl -6 probe.example.com'));
    assert.ok(!VERDICTS.test(help));
});

test('/help points at the IPv4 / IPv6 hosts when configured', () => {
    const help = renderHelp(split);
    assert.ok(help.includes('curl probe-4.example.com'));
    assert.ok(help.includes('curl probe-6.example.com'));
    assert.ok(!help.includes('curl -4'));
});

test('/llms.txt has the llms.txt shape and covers every field and error code', () => {
    const llms = renderLlmsTxt(bare);
    assert.ok(llms.startsWith('# MyIP Probe\n\n> '));
    for (const field of FIELDS) assert.ok(llms.includes(`- \`${field.key}\` (${field.type} or null, \`${fieldPath(field)}\`): ${field.description}`), field.key);
    for (const code of ERROR_CODES) assert.ok(llms.includes(`\`${code}\``), code);
    assert.ok(llms.includes('https://probe.example.com/json'));
    assert.match(llms, /public IP of the machine that sends the request/);
    assert.match(llms, /estimates/);
    assert.ok(!llms.includes('## IP versions'), 'no version hosts, no section');
    assert.ok(!VERDICTS.test(llms));
});

test('/llms.txt explains the IPv4 / IPv6 hosts when configured', () => {
    const llms = renderLlmsTxt(split);
    assert.ok(llms.includes('## IP versions'));
    assert.ok(llms.includes('`https://probe-4.example.com/` is reachable over IPv4 only'));
    assert.ok(llms.includes('`https://probe-6.example.com/` is reachable over IPv6 only'));
});

test('/openapi.json describes every route and field once', () => {
    const doc = renderOpenApi(bare) as {
        openapi: string;
        servers: { url: string }[];
        paths: Record<string, { get: { operationId: string } }>;
        components: { schemas: { ProbeInfo: { required: string[]; properties: Record<string, { type: string[] }> }; Error: { properties: { code: { enum: string[] } } } } };
    };
    assert.equal(doc.openapi, '3.1.0');
    assert.deepEqual(doc.servers, [{ url: 'https://probe.example.com' }]);
    for (const path of FIXED_PATHS) assert.ok(doc.paths[path], path);
    for (const field of FIELDS) {
        assert.ok(doc.paths[fieldPath(field)], field.key);
        assert.deepEqual(doc.components.schemas.ProbeInfo.properties[field.key]?.type, [field.type, 'null'], field.key);
    }
    assert.deepEqual(doc.components.schemas.ProbeInfo.required, FIELDS.map((field) => field.key));
    assert.equal(Object.keys(doc.paths).length, FIXED_PATHS.length + FIELDS.length);
    const ids = Object.values(doc.paths).map((path) => path.get.operationId);
    assert.equal(new Set(ids).size, ids.length, 'operationIds are unique');
    assert.deepEqual(doc.components.schemas.Error.properties.code.enum, [...ERROR_CODES]);
});
