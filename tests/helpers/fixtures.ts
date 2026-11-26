// Test helpers: build Requests and Connections the way the Worker entry will,
// and load the legacy fixtures.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CfData, Connection } from '../../src/core/connection.ts';
import type { RouterOptions } from '../../src/core/router.ts';

export interface LegacyCase {
    name: string;
    connection: string;
    client: string;
    path: string;
    expected: { status: number; contentType: string; body: string };
}

export interface LegacyFixtures {
    connections: Record<string, { ip: string; cf?: Record<string, unknown> }>;
    clients: Record<string, Record<string, string>>;
    cases: LegacyCase[];
}

// The fixture file is generated, not typed; its shape is the interface above.
export const legacyFixtures = JSON.parse(
    readFileSync(join(import.meta.dirname, '../fixtures/legacy/legacy.json'), 'utf8'),
) as LegacyFixtures;

// Fixture `cf` objects may carry values Cloudflare sends but its type
// definitions omit (such as country `XX`), so they are taken as CfData.
export const connectionFrom = (entry: { ip: string; cf?: Record<string, unknown> }): Connection => ({
    ip: entry.ip,
    cf: entry.cf as CfData | undefined,
});

export const connectionNamed = (name: string): Connection => {
    const entry = legacyFixtures.connections[name];
    if (!entry) throw new Error(`No fixture connection named ${name}`);
    return connectionFrom(entry);
};

export const CURL = { 'User-Agent': 'curl/8.7.1', Accept: '*/*' };
export const FETCH = { 'User-Agent': 'Mozilla/5.0 (Example) Browser/1.0', Accept: '*/*' };
export const BROWSER = {
    'User-Agent': 'Mozilla/5.0 (Example) Browser/1.0',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export const requestFor = (pathAndQuery: string, headers: Record<string, string> = FETCH): Request =>
    new Request('https://probe.example' + pathAndQuery, { headers });

export const PAGE_STUB = '<!doctype html><title>stub</title>';

export const routerOptions: RouterOptions = { renderPage: () => PAGE_STUB };
