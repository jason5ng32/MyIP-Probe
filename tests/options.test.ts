// optionsFromEnv: mapping deployment variables onto ProbeOptions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOrigin, optionsFromEnv } from '../src/options.ts';

test('an empty environment gives default options', () => {
    assert.deepEqual(optionsFromEnv({}), { ok: true, options: {} });
});

test('blank and non-string values count as unset', () => {
    assert.deepEqual(optionsFromEnv({ PROBE_PAGE: '  ', PROBE_HOST_V4: '', PROBE_HOST_V6: 42 }), { ok: true, options: {} });
});

test('every variable maps onto its option', () => {
    const result = optionsFromEnv({
        PROBE_PAGE: 'false',
        PROBE_LEGACY_NOTE: 'Self-hosted',
        PROBE_HOST: 'probe.example.com',
        PROBE_HOST_V4: 'Probe-4.Example.com',
        PROBE_HOST_V6: 'probe-6.example.com',
        PROBE_ALLOWED_ORIGINS: 'https://app.example.com, http://localhost:5173',
        PROBE_ALLOWED_ROOT_DOMAINS: 'Example.org,example.net',
    });
    assert.deepEqual(result, {
        ok: true,
        options: {
            page: false,
            legacyNote: 'Self-hosted',
            hosts: { main: 'probe.example.com', v4: 'probe-4.example.com', v6: 'probe-6.example.com' },
            cors: { origins: ['https://app.example.com', 'http://localhost:5173'], rootDomains: ['example.org', 'example.net'] },
        },
    });
});

test('page settings map onto options', () => {
    assert.deepEqual(
        optionsFromEnv({ PROBE_SITE_NAME: 'Example Lite', PROBE_GA_ID: 'G-ABC123', PROBE_FULL_REPORT_URL: 'off', PROBE_PRIVACY_NOTE: 'false' }),
        { ok: true, options: { privacyNote: false, siteName: 'Example Lite', gaMeasurementId: 'G-ABC123', fullReportUrl: null } },
    );
    assert.deepEqual(optionsFromEnv({ PROBE_FULL_REPORT_URL: 'https://example.org/r' }), { ok: true, options: { fullReportUrl: 'https://example.org/r' } });
    const bad = optionsFromEnv({ PROBE_GA_ID: 'UA-1', PROBE_FULL_REPORT_URL: 'http://example.org', PROBE_PRIVACY_NOTE: 'no' });
    assert.ok(!bad.ok && bad.problems.length === 3, JSON.stringify(bad));
});

test('a star allows any origin', () => {
    assert.deepEqual(optionsFromEnv({ PROBE_ALLOWED_ORIGINS: '*' }), { ok: true, options: { cors: { origins: '*' } } });
});

test('every problem is reported at once', () => {
    const result = optionsFromEnv({
        PROBE_PAGE: 'yes',
        PROBE_HOST_V4: 'https://probe-4.example.com',
        PROBE_HOST_V6: 'probe 6',
        PROBE_ALLOWED_ORIGINS: 'https://app.example.com/path,app.example.com',
        PROBE_ALLOWED_ROOT_DOMAINS: '*.example.com',
    });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.problems.length === 5, JSON.stringify(result));
});

test('the main, IPv4 and IPv6 hosts must all differ', () => {
    assert.equal(optionsFromEnv({ PROBE_HOST_V4: 'probe.example.com', PROBE_HOST_V6: 'probe.example.com' }).ok, false);
    assert.equal(optionsFromEnv({ PROBE_HOST: 'probe.example.com', PROBE_HOST_V4: 'probe.example.com' }).ok, false);
    assert.equal(optionsFromEnv({ PROBE_HOST: 'probe.example.com', PROBE_HOST_V4: 'probe-4.example.com' }).ok, true);
});

test('an origin is scheme and host only', () => {
    assert.equal(isOrigin('https://app.example.com'), true);
    assert.equal(isOrigin('http://localhost:8787'), true);
    assert.equal(isOrigin('https://app.example.com/'), false);
    assert.equal(isOrigin('ftp://app.example.com'), false);
    assert.equal(isOrigin('app.example.com'), false);
});
