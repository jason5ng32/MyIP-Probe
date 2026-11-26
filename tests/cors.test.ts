// corsHeaders: who may read the API from a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, isOriginAllowed } from '../src/core/cors.ts';
import type { ProbeOptions } from '../src/options.ts';

const options: ProbeOptions = {
    hosts: { v4: 'probe-4.example.com', v6: 'probe-6.example.com' },
    cors: { origins: ['http://localhost:5173'], rootDomains: ['example.org'] },
};
const HOST = 'probe.example.com';

test('no Origin gets a star', () => {
    assert.deepEqual(corsHeaders(null, HOST, options), { 'Access-Control-Allow-Origin': '*' });
});

test('the probe\'s own hostnames are always allowed', () => {
    for (const origin of ['https://probe.example.com', 'https://probe-4.example.com', 'https://probe-6.example.com']) {
        assert.equal(isOriginAllowed(origin, HOST, {}), origin.includes('probe.example') ? true : false, `${origin} without hosts`);
        assert.equal(isOriginAllowed(origin, HOST, options), true, origin);
    }
});

test('listed origins match exactly', () => {
    assert.equal(isOriginAllowed('http://localhost:5173', HOST, options), true);
    assert.equal(isOriginAllowed('http://localhost:5174', HOST, options), false);
});

test('root domains cover themselves and subdomains over https only', () => {
    assert.equal(isOriginAllowed('https://example.org', HOST, options), true);
    assert.equal(isOriginAllowed('https://app.example.org', HOST, options), true);
    assert.equal(isOriginAllowed('http://app.example.org', HOST, options), false);
    assert.equal(isOriginAllowed('https://badexample.org', HOST, options), false);
});

test('the IPv6 host accepts the page on the main host', () => {
    const hosts = { main: 'probe.example.com', v4: 'probe-4.example.com', v6: 'probe-6.example.com' };
    assert.equal(isOriginAllowed('https://probe.example.com', 'probe-6.example.com', { hosts }), true);
    assert.equal(isOriginAllowed('https://probe.example.com', 'probe-6.example.com', { hosts: { v6: hosts.v6 } }), false, 'unless the main host is named');
});

test('a star allows any origin', () => {
    assert.equal(isOriginAllowed('https://anywhere.test', HOST, { cors: { origins: '*' } }), true);
});

test('an allowed origin is echoed; a refused one gets no allow header', () => {
    assert.deepEqual(corsHeaders('https://app.example.org', HOST, options), {
        'Access-Control-Allow-Origin': 'https://app.example.org',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
    });
    assert.deepEqual(corsHeaders('https://evil.test', HOST, options), { Vary: 'Origin' });
    assert.deepEqual(corsHeaders('null', HOST, options), { Vary: 'Origin' });
});
