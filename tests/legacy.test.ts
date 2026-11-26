// Pins `/` and `/geo` to the original 4./6./64.ipcheck.ing output, byte for
// byte, using fixtures generated from that service's own handlers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleProbeRequest } from '../src/core/router.ts';
import { connectionNamed, legacyFixtures, requestFor, routerOptions } from './helpers/fixtures.ts';

for (const fixture of legacyFixtures.cases) {
    test(`legacy ${fixture.name}`, async () => {
        const headers = legacyFixtures.clients[fixture.client];
        assert.ok(headers, `client ${fixture.client} exists`);
        const response = handleProbeRequest(requestFor(fixture.path, headers), connectionNamed(fixture.connection), routerOptions);
        assert.equal(response.status, fixture.expected.status);
        assert.equal(response.headers.get('Content-Type'), fixture.expected.contentType);
        assert.equal(await response.text(), fixture.expected.body);
    });
}

test('legacy fixtures cover every connection on both endpoints', () => {
    const covered = new Set(legacyFixtures.cases.map((c) => `${c.connection} ${c.path}`));
    for (const connection of Object.keys(legacyFixtures.connections)) {
        assert.ok(covered.has(`${connection} /`), `${connection} /`);
        assert.ok(covered.has(`${connection} /geo`), `${connection} /geo`);
    }
});

test('the legacy note is configurable', async () => {
    const response = handleProbeRequest(
        requestFor('/geo?format=json'),
        connectionNamed('full_v4'),
        { ...routerOptions, legacyNote: 'Self-hosted probe' },
    );
    assert.equal(JSON.parse(await response.text()).note, 'Self-hosted probe');
});
