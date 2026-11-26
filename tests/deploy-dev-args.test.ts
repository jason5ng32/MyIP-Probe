// devDeployConfig: the test deployment's Wrangler configuration and its guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseConfigFromToml, devDeployConfig } from '../scripts/deploy-dev-args.ts';

const base = { main: 'src/worker.ts', compatibility_date: '2026-11-20' };

const valid = {
    CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef',
    PROBE_DEV_WORKER_NAME: 'myip-probe-dev',
    PROBE_DEV_ZONE: 'example.com',
    PROBE_DEV_HOST: 'probe-dev.example.com',
    PROBE_HOST_V4: 'probe-dev-4.example.com',
    PROBE_HOST_V6: 'probe-dev-6.example.com',
};

test('the main host is a Custom Domain, the IPv4 / IPv6 hosts are zone routes, set variables are forwarded', () => {
    assert.deepEqual(devDeployConfig({ ...valid, PROBE_PAGE: '', PROBE_ALLOWED_ORIGINS: 'https://app.example.com' }, base), {
        ok: true,
        config: {
            main: 'src/worker.ts',
            compatibility_date: '2026-11-20',
            name: 'myip-probe-dev',
            workers_dev: true,
            routes: [
                { pattern: 'probe-dev.example.com', zone_name: 'example.com', custom_domain: true },
                { pattern: 'probe-dev-4.example.com/*', zone_name: 'example.com' },
                { pattern: 'probe-dev-6.example.com/*', zone_name: 'example.com' },
            ],
            vars: {
                PROBE_HOST: 'probe-dev.example.com',
                PROBE_HOST_V4: 'probe-dev-4.example.com',
                PROBE_HOST_V6: 'probe-dev-6.example.com',
                PROBE_ALLOWED_ORIGINS: 'https://app.example.com',
            },
        },
        warnings: [],
    });
});

test('warns when an IPv4 / IPv6 host sits deeper than the zone wildcard covers', () => {
    const result = devDeployConfig(
        { ...valid, PROBE_DEV_HOST: 'get.test.example.com', PROBE_HOST_V4: '4.get.test.example.com', PROBE_HOST_V6: 'probe-dev-6.example.com' },
        base,
    );
    assert.ok(result.ok);
    assert.equal(result.warnings.length, 1, 'the Custom Domain host gets its own certificate');
    assert.match(result.warnings[0] ?? '', /PROBE_HOST_V4 \(4\.get\.test\.example\.com\)/);
});

test('the IPv4 and IPv6 hostnames are optional', () => {
    const result = devDeployConfig({ ...valid, PROBE_HOST_V4: '', PROBE_HOST_V6: undefined }, base);
    assert.ok(result.ok);
    assert.deepEqual(result.config.routes, [{ pattern: 'probe-dev.example.com', zone_name: 'example.com', custom_domain: true }]);
    assert.deepEqual(result.config.vars, { PROBE_HOST: 'probe-dev.example.com' });
});

test('refuses to deploy without an account, a name, a zone or a host', () => {
    const result = devDeployConfig({}, base);
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.problems.length === 4, JSON.stringify(result));
});

test('refuses the production Worker name', () => {
    assert.equal(devDeployConfig({ ...valid, PROBE_DEV_WORKER_NAME: 'myip-probe' }, base).ok, false);
});

test('refuses hostnames outside the zone', () => {
    const result = devDeployConfig({ ...valid, PROBE_HOST_V6: 'probe-dev-6.example.net' }, base);
    assert.ok(!result.ok && result.problems[0]?.includes('outside PROBE_DEV_ZONE'));
    assert.equal(devDeployConfig({ ...valid, PROBE_DEV_HOST: 'badexample.com' }, base).ok, false);
});

test('reads main and compatibility_date from the real wrangler.toml', () => {
    const toml = readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8');
    assert.deepEqual(baseConfigFromToml(toml), { main: 'src/worker.ts', compatibility_date: '2026-11-20' });
    assert.equal(baseConfigFromToml('name = "x"'), null);
});
