// The field registry: naming rules, value shaping and output order.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, fieldForPath, fieldPath, fieldText, readInfo } from '../src/core/fields.ts';
import { FIXED_PATHS } from '../src/core/router.ts';
import { connectionNamed } from './helpers/fixtures.ts';

test('keys are unique lowercase snake_case and paths derive from them', () => {
    const keys = FIELDS.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const field of FIELDS) {
        assert.match(field.key, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
        assert.equal(fieldPath(field), '/' + field.key.replaceAll('_', '-'));
        assert.equal(fieldForPath(fieldPath(field)), field);
        assert.ok(field.label.length > 0, `${field.key} has a label`);
        assert.ok(field.description.endsWith('.'), `${field.key} description is a sentence`);
    }
});

test('no field path collides with a fixed route', () => {
    for (const reserved of FIXED_PATHS) {
        assert.equal(fieldForPath(reserved), undefined, reserved);
    }
});

test('a full IPv4 connection reads every field, in registry order', () => {
    assert.deepEqual(readInfo(connectionNamed('full_v4')), {
        ip: '203.0.113.42',
        ip_version: 4,
        city: 'Exampleton',
        region: 'Example Province',
        region_code: 'EP',
        postal_code: '1011',
        country: 'Netherlands',
        country_code: 'NL',
        continent_code: 'EU',
        is_eu: true,
        latitude: 52.3702,
        longitude: 4.89517,
        timezone: 'Europe/Amsterdam',
        asn: 64500,
        asn_org: 'Example Networks B.V.',
        colo: 'AMS',
        http_protocol: 'HTTP/2',
        tls_version: 'TLSv1.3',
        tls_cipher: 'AEAD-AES128-GCM-SHA256',
        tcp_rtt_ms: 12,
    });
    assert.deepEqual(Object.keys(readInfo(connectionNamed('full_v4'))), FIELDS.map((f) => f.key));
});

test('an IPv6 connection outside the EU over HTTP/3', () => {
    const info = readInfo(connectionNamed('full_v6'));
    assert.equal(info.ip_version, 6);
    assert.equal(info.country, 'Japan');
    assert.equal(info.is_eu, false);
    assert.equal(info.tcp_rtt_ms, null, 'a 0 RTT means no TCP measurement');
});

test('missing data reads as null, never as a placeholder', () => {
    const sparse = readInfo(connectionNamed('sparse'));
    assert.equal(sparse.country_code, 'XX');
    assert.equal(sparse.country, null, 'XX has no country name');
    assert.equal(sparse.city, null);
    assert.equal(sparse.asn, null);
    assert.equal(sparse.latitude, null);
    assert.equal(sparse.is_eu, false);

    const bare = readInfo(connectionNamed('no_cf'));
    for (const field of FIELDS) {
        if (field.key === 'ip' || field.key === 'ip_version') continue;
        assert.equal(bare[field.key], null, field.key);
    }
});

test('Tor (T1) keeps its code but has no country name', () => {
    const info = readInfo({ ip: '192.0.2.9', cf: { country: 'T1' } });
    assert.equal(info.country_code, 'T1');
    assert.equal(info.country, null);
});

test('coordinates that are not numbers read as null', () => {
    const info = readInfo({ ip: '192.0.2.9', cf: { latitude: 'n/a', longitude: '' } });
    assert.equal(info.latitude, null);
    assert.equal(info.longitude, null);
});

test('plain-text values are single lines', () => {
    assert.equal(fieldText(64500), '64500');
    assert.equal(fieldText(true), 'true');
    assert.equal(fieldText('AMS'), 'AMS');
});

test('every value matches its declared type', () => {
    const jsonType = (value: unknown): string =>
        typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value;
    for (const name of ['full_v4', 'full_v6', 'sparse', 'no_cf']) {
        const info = readInfo(connectionNamed(name));
        for (const field of FIELDS) {
            const value = info[field.key];
            if (value === null || value === undefined) continue;
            const actual = jsonType(value);
            assert.ok(actual === field.type || (field.type === 'number' && actual === 'integer'), `${name} ${field.key}: ${actual} vs ${field.type}`);
        }
    }
});
