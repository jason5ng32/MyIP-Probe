// createProbe and the stand-alone Worker, driven with Requests carrying a
// fake `request.cf`, the way the runtime delivers them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProbe } from '../src/probe.ts';
import worker from '../src/worker.ts';
import { BROWSER, CURL, FETCH, legacyFixtures } from './helpers/fixtures.ts';

const full = legacyFixtures.connections.full_v4;
if (!full) throw new Error('full_v4 fixture missing');

// Typed as the runtime's incoming Request: defineProperty attaches the
// incoming `cf` the runtime would.
type IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const incoming = (path: string, init: { method?: string; headers?: Record<string, string> } = {}): IncomingRequest => {
    const request = new Request('https://probe.example.com' + path, {
        method: init.method ?? 'GET',
        headers: { 'CF-Connecting-IP': full.ip, ...(init.headers ?? FETCH) },
    });
    Object.defineProperty(request, 'cf', { value: full.cf });
    return request as IncomingRequest;
};

test('the probe reads the address and request.cf', async () => {
    const body = JSON.parse(await createProbe().fetch(incoming('/json')).text());
    assert.equal(body.ip, '203.0.113.42');
    assert.equal(body.city, 'Exampleton');
    assert.equal(body.colo, 'AMS');
});

test('the page is served by default and can be turned off', async () => {
    const withPage = createProbe().fetch(incoming('/', { headers: BROWSER }));
    assert.equal(withPage.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.match(await withPage.text(), /Exampleton/);

    const apiOnly = createProbe({ page: false });
    assert.equal(apiOnly.fetch(incoming('/', { headers: BROWSER })).headers.get('Content-Type'), 'application/json');
    assert.equal(await apiOnly.fetch(incoming('/', { headers: CURL })).text(), '203.0.113.42\n');
    assert.equal(apiOnly.fetch(incoming('/?format=html', { headers: BROWSER })).status, 400);
});

test('the legacy note follows the options', async () => {
    const body = JSON.parse(await createProbe({ legacyNote: 'Self-hosted' }).fetch(incoming('/geo')).text());
    assert.equal(body.note, 'Self-hosted');
});

test('HEAD answers with headers and no body', async () => {
    const response = createProbe().fetch(incoming('/json', { method: 'HEAD' }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(await response.text(), '');
});

test('OPTIONS is a 204 with the allowed methods', () => {
    const response = createProbe().fetch(incoming('/json', { method: 'OPTIONS', headers: { Origin: 'https://probe.example.com' } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://probe.example.com');
});

test('other methods are a 405', async () => {
    const response = createProbe().fetch(incoming('/json', { method: 'POST' }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD, OPTIONS');
    assert.deepEqual(JSON.parse(await response.text()), { error: 'Method POST is not allowed', code: 'method_not_allowed' });
});

test('CORS headers ride on every answer', () => {
    const probe = createProbe({ hosts: { v4: 'probe-4.example.com' } });
    assert.equal(probe.fetch(incoming('/ip')).headers.get('Access-Control-Allow-Origin'), '*');
    const fromV4 = probe.fetch(incoming('/ip', { headers: { ...FETCH, Origin: 'https://probe-4.example.com' } }));
    assert.equal(fromV4.headers.get('Access-Control-Allow-Origin'), 'https://probe-4.example.com');
    const fromElsewhere = probe.fetch(incoming('/ip', { headers: { ...FETCH, Origin: 'https://evil.test' } }));
    assert.equal(fromElsewhere.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(fromElsewhere.headers.get('Cache-Control'), 'no-store');
});

test('a wrapper can serve hostnames with different options', async () => {
    const page = createProbe();
    const api = createProbe({ page: false });
    const serve = (request: Request): Response => (new URL(request.url).hostname.startsWith('api.') ? api : page).fetch(request);
    const navigation = (host: string): Request => {
        const request = new Request(`https://${host}/`, { headers: { 'CF-Connecting-IP': full.ip, ...BROWSER } });
        Object.defineProperty(request, 'cf', { value: full.cf });
        return request;
    };
    assert.equal(serve(navigation('probe.example.com')).headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.equal(await serve(navigation('api.example.com')).text(), '{"ip":"203.0.113.42"}');
});

test('the Worker answers 500 with every configuration problem', async () => {
    const response = await worker.fetch(incoming('/json'), { PROBE_PAGE: 'maybe', PROBE_HOST_V4: 'not a host' });
    assert.equal(response.status, 500);
    const body = JSON.parse(await response.text());
    assert.equal(body.code, 'bad_config');
    assert.match(body.error, /PROBE_PAGE/);
    assert.match(body.error, /PROBE_HOST_V4/);
});

test('the Worker serves a valid configuration', async () => {
    const response = await worker.fetch(incoming('/ip', { headers: CURL }), { PROBE_PAGE: 'false' });
    assert.equal(await response.text(), '203.0.113.42\n');
});
