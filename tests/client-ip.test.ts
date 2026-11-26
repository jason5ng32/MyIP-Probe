// clientIp: trusting only the headers Cloudflare sets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from '../src/core/client-ip.ts';

const headers = (values: Record<string, string>): Headers => new Headers(values);

test('CF-Connecting-IP is the address', () => {
    assert.equal(clientIp(headers({ 'CF-Connecting-IP': '203.0.113.42' })), '203.0.113.42');
    assert.equal(clientIp(headers({ 'CF-Connecting-IP': '2001:db8::42' })), '2001:db8::42');
});

test('X-Forwarded-For is never trusted', () => {
    assert.equal(clientIp(headers({ 'X-Forwarded-For': '198.51.100.1' })), null);
    assert.equal(clientIp(headers({ 'CF-Connecting-IP': '203.0.113.42', 'X-Forwarded-For': '198.51.100.1' })), '203.0.113.42');
});

test('a Pseudo IPv4 stand-in gives way to the real IPv6 address', () => {
    assert.equal(clientIp(headers({ 'CF-Connecting-IP': '240.16.0.1', 'CF-Connecting-IPv6': '2001:db8::42' })), '2001:db8::42');
});

test('CF-Connecting-IPv6 is ignored beside a real IPv4 address', () => {
    assert.equal(clientIp(headers({ 'CF-Connecting-IP': '203.0.113.42', 'CF-Connecting-IPv6': '2001:db8::42' })), '203.0.113.42');
});
