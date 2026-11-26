// Routing and format resolution for the new endpoints.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, fieldPath } from '../src/core/fields.ts';
import { handleProbeRequest } from '../src/core/router.ts';
import { BROWSER, CURL, FETCH, PAGE_STUB, connectionNamed, requestFor, routerOptions } from './helpers/fixtures.ts';

const full = connectionNamed('full_v4');
const sparse = connectionNamed('sparse');

const get = (path: string, headers: Record<string, string> = FETCH, connection = full): Response =>
    handleProbeRequest(requestFor(path, headers), connection, routerOptions);

test('/json returns every field, pretty-printed with a trailing newline', async () => {
    const response = get('/json');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    const body = await response.text();
    assert.ok(body.endsWith('}\n'));
    assert.deepEqual(Object.keys(JSON.parse(body)), FIELDS.map((f) => f.key));
});

test('/json keeps missing values as null', async () => {
    const body = JSON.parse(await get('/json', FETCH, sparse).text());
    assert.equal(body.city, null);
    assert.equal(body.country_code, 'XX');
});

test('every field has a text endpoint, whatever the client', async () => {
    for (const field of FIELDS) {
        for (const headers of [CURL, FETCH, BROWSER]) {
            const response = get(fieldPath(field), headers);
            assert.equal(response.status, 200, field.key);
            assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
            const body = await response.text();
            assert.equal(body.split('\n').length, 2, `${field.key} is one line`);
        }
    }
    assert.equal(await get('/asn').text(), '64500\n');
    assert.equal(await get('/country-code').text(), 'NL\n');
});

test('?format=json on a field returns a one-key object', async () => {
    const response = get('/asn?format=json');
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.deepEqual(JSON.parse(await response.text()), { asn: 64500 });
});

test('a field without data is a 404 in either format', async () => {
    const text = get('/city', CURL, sparse);
    assert.equal(text.status, 404);
    assert.equal(await text.text(), 'City is not available for this connection\n');

    const json = get('/city?format=json', FETCH, sparse);
    assert.equal(json.status, 404);
    assert.deepEqual(JSON.parse(await json.text()), { error: 'City is not available for this connection', code: 'not_available' });
});

test('/ serves the page to a browser navigation only', async () => {
    const page = get('/', BROWSER);
    assert.equal(page.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.equal(await page.text(), PAGE_STUB);
    assert.equal(await get('/?format=html', FETCH).text(), PAGE_STUB);
    assert.equal(await get('/', CURL).text(), '203.0.113.42\n');
    assert.equal(await get('/', FETCH).text(), '{"ip":"203.0.113.42"}');
});

test('?format= overrides the client on the legacy routes', async () => {
    assert.equal(await get('/?format=text', BROWSER).text(), '203.0.113.42\n');
    assert.equal(await get('/?format=json', CURL).text(), '{"ip":"203.0.113.42"}');
    assert.equal(get('/geo?format=text', FETCH).headers.get('Content-Type'), 'text/plain');
    assert.equal(get('/geo?format=JSON', CURL).headers.get('Content-Type'), 'application/json');
});

test('/geo never serves the page', () => {
    assert.equal(get('/geo', BROWSER).headers.get('Content-Type'), 'application/json');
    assert.equal(get('/geo?format=html', BROWSER).status, 400);
});

test('a format a route cannot answer in is a 400', async () => {
    const json = get('/json?format=text');
    assert.equal(json.status, 400);
    assert.deepEqual(JSON.parse(await json.text()), {
        error: 'Unsupported format "text"; use one of: json',
        code: 'bad_format',
    });
    assert.equal(get('/city?format=html').status, 400);
    assert.equal(get('/ip?format=xml', CURL).status, 400);
    assert.equal(await get('/ip?format=xml', CURL).text(), 'Unsupported format "xml"; use one of: text, json\n');
});

test('unknown paths are a 404 in the client\'s format', async () => {
    const json = get('/nope');
    assert.equal(json.status, 404);
    assert.deepEqual(JSON.parse(await json.text()), { error: 'Not found', code: 'not_found' });
    const text = get('/nope', CURL);
    assert.equal(await text.text(), 'Not found\n');
    assert.equal(get('/city/').status, 404, 'no trailing-slash aliases');
});

test('nothing is cacheable', () => {
    for (const path of ['/', '/json', '/geo', '/ip', '/nope', '/json?format=text']) {
        assert.equal(get(path).headers.get('Cache-Control'), 'no-store', path);
    }
    assert.equal(get('/', BROWSER).headers.get('Cache-Control'), 'no-store');
});

test('the docs and health endpoints answer in their formats', async () => {
    const help = get('/help', BROWSER);
    assert.equal(help.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.match(await help.text(), /curl probe\.example\/json/);

    const llms = get('/llms.txt', CURL);
    assert.equal(llms.headers.get('Content-Type'), 'text/markdown; charset=utf-8');
    assert.ok((await llms.text()).startsWith('# MyIP Probe'));

    const openapi = get('/openapi.json');
    assert.equal(JSON.parse(await openapi.text()).openapi, '3.1.0');

    assert.deepEqual(JSON.parse(await get('/health', CURL).text()), { status: 'ok' });
    assert.equal(await get('/health?format=text').text(), 'ok\n');
    assert.equal(get('/help?format=json').status, 400);
    assert.equal(get('/openapi.json?format=text').status, 400);
});
