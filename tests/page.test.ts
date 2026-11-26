// The page renderer: structure generated from the registry, escaping, and
// the settings that switch parts of it on and off. Visual checks are the
// maintainer's, in a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, fieldPath, readInfo } from '../src/core/fields.ts';
import { PAGE_SCRIPT } from '../src/page/script.ts';
import { DESCRIPTION, TRACE_URLS, renderPage, type PageSettings } from '../src/page/page.ts';
import { createProbe } from '../src/probe.ts';
import { connectionNamed } from './helpers/fixtures.ts';

const settings: PageSettings = {
    siteName: 'MyIP Probe',
    hosts: {},
    gaMeasurementId: null,
    fullReportUrl: 'https://ipcheck.ing',
    privacyNote: true,
};
const request = { host: 'probe.example.com' };
const v4 = readInfo(connectionNamed('full_v4'));
const v6 = readInfo(connectionNamed('full_v6'));

// The `#probe-data` block the script reads.
const pageData = (html: string): { host: string; ips: Record<string, string | null>; other: { version: number; url: string; kind: string } | null; summary: string[]; json: string } => {
    const match = html.match(/<script type="application\/json" id="probe-data">(.*?)<\/script>/s);
    assert.ok(match?.[1], 'page data block present');
    return JSON.parse(match[1]);
};

test('every field is a line whose path copies its curl command, never a link', () => {
    const html = renderPage(v4, request, settings);
    for (const field of FIELDS.filter((f) => f.group !== 'address')) {
        assert.ok(html.includes(`data-copy-text="curl probe.example.com${fieldPath(field)}"`), field.key);
        assert.ok(html.includes(`>${field.key}</dt>`), `${field.key} is shown by its JSON key`);
        assert.ok(!new RegExp(`<a [^>]*href="${fieldPath(field)}"`).test(html), `${field.key} is not a link`);
    }
    assert.ok(!/<a [^>]*href="\/json"/.test(html), '/json is not a link either');
    assert.ok(!html.includes('<dialog'), 'no dialog');
});

test('keys take their group\'s accent; commands hide on phones', () => {
    const html = renderPage(v4, request, settings);
    assert.match(html, /<dt class="font-semibold text-ctp-mauve">ipv4<\/dt>/);
    assert.match(html, /<dt class="font-semibold text-ctp-blue"[^>]*>city<\/dt>/);
    assert.match(html, /<dt class="font-semibold text-ctp-pink"[^>]*>asn<\/dt>/);
    assert.match(html, /<dt class="font-semibold text-ctp-sapphire"[^>]*>colo<\/dt>/);
    assert.ok(html.includes('<dd class="justify-self-end max-sm:hidden">'));
});

test('definition lists hold only dt and dd lines', () => {
    const html = renderPage(v4, request, settings);
    const lists = html.match(/<dl>[\s\S]*?<\/dl>/g) ?? [];
    assert.ok(lists.length >= 4);
    for (const list of lists) {
        const inner = list.slice(4, -5).replace(/<div[^>]*>|<\/div>/g, '');
        assert.ok(!/<(?!\/?(dt|dd|span|button|noscript)\b)[a-z]/.test(inner), 'only dt / dd (with inline content) inside lines');
    }
});

test('the page says what it is and how to call it, with this host', () => {
    const html = renderPage(v4, request, settings);
    const description = DESCRIPTION.replace(/'/g, '&#39;');
    assert.ok(html.includes(`<p class="leading-6">${description}</p>`));
    assert.ok(html.includes(`<meta name="description" content="${description}">`));
    const usage = [...html.matchAll(/<dt>(.*?)<\/dt><dd class="text-muted-foreground/g)].map((m) => (m[1] ?? '').replace(/<[^>]+>/g, ''));
    assert.deepEqual(usage, ['curl probe.example.com', 'curl probe.example.com/json', 'curl probe.example.com/&lt;key&gt;', 'curl -4 probe.example.com', 'curl probe.example.com/help']);
    assert.ok(html.includes('<dt><span class="text-ctp-mauve">curl</span> <span class="text-ctp-green">probe.example.com</span><span class="text-ctp-sapphire">/json</span></dt>'), 'usage commands are coloured');
});

test('top to bottom: your IP, then what this is, then the fields', () => {
    const html = renderPage(v4, request, settings);
    const yourIp = html.indexOf('>Your IP</h1>');
    const ip = html.indexOf('203.0.113.42', yourIp);
    const description = html.indexOf(`<p class="leading-6">${DESCRIPTION.replace(/'/g, '&#39;')}</p>`);
    const fields = html.indexOf('# addresses');
    assert.ok(yourIp > 0 && yourIp < ip && ip < description && description < fields, `${yourIp} ${ip} ${description} ${fields}`);
    assert.ok(html.slice(yourIp, description).includes('data-copy="ip:4"'), 'the IP has its copy button');
});

test('the json tab is a box with its own copy button, carrying /json', () => {
    const html = renderPage(v4, request, settings);
    assert.match(html, /<div id="view-json" role="tabpanel" class="rounded-lg border"/);
    assert.ok(html.includes('data-copy="json"'));
    assert.equal(pageData(html).json, JSON.stringify(v4, null, 2));
});

test('the head carries the favicon, sharing tags and theme colours', () => {
    const html = renderPage(v4, request, { ...settings, siteName: 'Example Lite' });
    const icon = html.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)">/);
    assert.ok(icon?.[1], 'favicon link');
    const svg = decodeURIComponent(icon[1]);
    assert.ok(svg.startsWith('<svg') && svg.includes('viewBox="0 0 511 512.35"') && svg.includes('prefers-color-scheme:dark'));
    assert.ok(!icon[1].includes('"'), 'the data URL never closes the attribute');
    assert.ok(html.includes('<meta property="og:title" content="Example Lite">'));
    assert.ok(html.includes('<meta property="og:url" content="https://probe.example.com/">'));
    assert.ok(html.includes(`<meta property="og:description" content="${DESCRIPTION.replace(/'/g, '&#39;')}">`));
    assert.ok(html.includes('<meta name="twitter:card" content="summary">'));
    assert.ok(html.includes('<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1e1e2e">'));
    assert.ok(html.includes('<meta name="generator" content="MyIP-Probe">'));
    assert.ok(html.includes('<meta name="author" content="Jason Ng">'));
});

test('the head points agents at the docs', () => {
    const html = renderPage(v4, request, settings);
    assert.ok(html.includes('<link rel="alternate" type="text/markdown" href="/llms.txt"'));
    assert.ok(html.includes('<link rel="service-desc" type="application/openapi+json" href="/openapi.json">'));
    assert.ok(html.includes('<link rel="help" type="text/plain" href="/help">'));
});

test('the page carries the logo and the generated stylesheet', () => {
    const html = renderPage(v4, request, settings);
    assert.ok(html.includes('viewBox="0 0 511 512.35"'));
    assert.match(html, /<style>\/\*! tailwindcss v4/);
});

test('the connection\'s own address fills its line; the other one is looked up', () => {
    const html = renderPage(v4, request, settings);
    assert.match(html, /data-ip-card="4" data-state="found"[\s\S]*?203\.0\.113\.42 <span class="text-success">← this connection/);
    assert.match(html, /data-ip-card="6" data-state="checking"/);
    assert.deepEqual(pageData(html).other, { version: 6, url: TRACE_URLS[6], kind: 'trace' });
    assert.deepEqual(pageData(renderPage(v6, request, settings)).other, { version: 4, url: TRACE_URLS[4], kind: 'trace' });
});

test('configured v4 / v6 hosts replace the trace lookup and the curl examples', () => {
    const html = renderPage(v4, request, { ...settings, hosts: { v4: 'probe-4.example.com', v6: 'probe-6.example.com' } });
    assert.deepEqual(pageData(html).other, { version: 6, url: 'https://probe-6.example.com/ip?format=json', kind: 'probe' });
    assert.ok(html.includes('data-copy-text="curl probe-6.example.com"'));
    assert.ok(html.includes('data-copy-text="curl probe-4.example.com"'));
    const bare = renderPage(v4, request, settings);
    assert.ok(bare.includes('data-copy-text="curl -4 probe.example.com"'));
    assert.ok(bare.includes('data-copy-text="curl -6 probe.example.com"'));
});

test('values are escaped everywhere, including the data block', () => {
    const hostile = readInfo({ ip: '203.0.113.42', cf: { city: '<script>alert(1)</script>', asOrganization: '"Quote" & </script>' } });
    const html = renderPage(hostile, request, settings);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.equal(html.match(/<\/script>/g)?.length, 2, 'only the data block and the page script close');
    assert.deepEqual(pageData(html).summary[0], 'Location: <script>alert(1)</script>');
});

test('values show as the text endpoints return them; the json tab is /json, highlighted', () => {
    const html = renderPage(readInfo(connectionNamed('sparse')), request, settings);
    assert.match(html, />colo<\/dt>\n<dd[^>]*>SIN<\/dd>/);
    assert.match(html, />city<\/dt>\n<dd[^>]*><span class="text-muted-foreground">—<\/span><\/dd>/);
    assert.match(renderPage(v4, request, settings), />is_eu<\/dt>\n<dd[^>]*>true<\/dd>/);
    assert.ok(html.includes('<span class="text-ctp-blue">&quot;country_code&quot;</span>: <span class="text-ctp-green">&quot;XX&quot;</span>'));
});

test('no external resource loads without a GA id', () => {
    const html = renderPage(v4, request, settings);
    assert.ok(!/<script[^>]+src=/.test(html));
    assert.ok(!/<link[^>]+rel="stylesheet"/.test(html));
    assert.ok(!html.includes('googletagmanager'));
});

test('a GA id loads gtag', () => {
    const html = renderPage(v4, request, { ...settings, gaMeasurementId: 'G-TEST123' });
    assert.ok(html.includes('https://www.googletagmanager.com/gtag/js?id=G-TEST123'));
    assert.ok(html.includes("gtag('config','G-TEST123')"));
});

test('the probe defaults: privacy line only without GA, report link on ipcheck.ing', async () => {
    const navigation = (): Request => {
        const r = new Request('https://probe.example.com/', { headers: { 'CF-Connecting-IP': '203.0.113.42', Accept: 'text/html' } });
        return r;
    };
    const plain = await createProbe().fetch(navigation()).text();
    assert.ok(plain.includes('# this probe keeps no logs and runs no analytics'));
    assert.match(plain, /# full report: <a [^>]*href="https:\/\/ipcheck\.ing">ipcheck\.ing<\/a>/);
    assert.ok(plain.includes('<title>MyIP Probe</title>'));

    const tracked = await createProbe({ gaMeasurementId: 'G-TEST123' }).fetch(navigation()).text();
    assert.ok(!tracked.includes('keeps no logs'));

    const wrapped = await createProbe({ privacyNote: false, fullReportUrl: null, siteName: 'Example Lite' }).fetch(navigation()).text();
    assert.ok(!wrapped.includes('keeps no logs'));
    assert.ok(!wrapped.includes('# full report'));
    assert.ok(wrapped.includes('<title>Example Lite</title>'));

    const custom = await createProbe({ fullReportUrl: 'https://example.org/report' }).fetch(navigation()).text();
    assert.match(custom, /href="https:\/\/example\.org\/report">example\.org<\/a>/);
});

test('the page script is valid JavaScript', () => {
    assert.doesNotThrow(() => new Function(PAGE_SCRIPT));
});
