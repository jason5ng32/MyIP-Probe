// The page served at `/` to a browser, terminal-style in the Catppuccin
// palette. Top to bottom: the caller's IP with a copy button (what a visitor
// came for), what this is and how to call it, then fastfetch-style
// `key value` lines per field group, keys being the JSON field names in
// their group's accent colour. Each line's endpoint path copies its curl
// command (desktop only; phones get one dense line per field); nothing on
// the page sends a request to the API. The json tab shows /json highlighted
// in a box with its own copy button. External requests are only the
// other-IP lookup and, when configured, Google Analytics.

import { FIELDS, fieldPath, fieldText, type FieldGroup, type FieldSpec, type FieldValue, type ProbeInfo } from '../core/fields.ts';
import type { ProbeHosts } from '../options.ts';
import { escapeHtml as e } from './html.ts';
import { highlightCurl, highlightPath } from './curl-highlight.ts';
import { highlightJson } from './json-highlight.ts';
import { FAVICON_DATA_URL, LOGO_SVG } from './logo.ts';
import { PAGE_SCRIPT } from './script.ts';
import { PAGE_CSS } from './styles.generated.ts';
import { TABS_LIST, TABS_TRIGGER, buttonClass } from './ui.ts';

export interface PageSettings {
    readonly siteName: string;
    readonly hosts: ProbeHosts;
    readonly gaMeasurementId: string | null;
    readonly fullReportUrl: string | null;
    readonly privacyNote: boolean;
}

export interface PageRequest {
    // Hostname the page was requested on; used in the curl commands.
    readonly host: string;
}

export const PROJECT_URL = 'https://github.com/jason5ng32/MyIP-Probe';

// The page's author, kept by forks unless they edit it, like the logo.
export const AUTHOR = 'Jason Ng';

// Cloudflare's public trace endpoints, reachable over one IP version each.
export const TRACE_URLS = {
    4: 'https://1.0.0.1/cdn-cgi/trace',
    6: 'https://[2606:4700:4700::1111]/cdn-cgi/trace',
} as const;

const SECTIONS: readonly { group: FieldGroup; heading: string }[] = [
    { group: 'location', heading: '# location · estimated' },
    { group: 'network', heading: '# network' },
    { group: 'connection', heading: '# connection' },
];

/* ── Lines ─────────────────────────────────────────────────────── */

// Desktop: key | value | command. Phone: key | value on one line.
const LINE = 'grid grid-cols-[9rem_minmax(0,1fr)_auto] items-baseline gap-x-4 max-sm:grid-cols-[7.5rem_minmax(0,1fr)] max-sm:gap-x-3';
const VALUE = 'min-w-0 break-all';

// Each group's keys take one Catppuccin accent, as fastfetch colours its labels.
const KEY: Record<FieldGroup, string> = {
    address: 'font-semibold text-ctp-mauve',
    location: 'font-semibold text-ctp-blue',
    network: 'font-semibold text-ctp-pink',
    connection: 'font-semibold text-ctp-sapphire',
};
const NONE = '<span class="text-muted-foreground">—</span>';

// An inline button copying `text`; its label (HTML, already escaped) turns
// to "copied" for a moment.
const copyButton = (labelHtml: string, attributes: string, extra = ''): string =>
    `<button type="button" class="${buttonClass('ghost', 'xs')} font-mono font-normal text-muted-foreground ${extra}" ${attributes}><span data-copy-label>${labelHtml}</span></button>`;

// A line's last column: a button copying its curl command. A second <dd>,
// as a <dl> line may hold only <dt> and <dd>.
const commandCell = (labelHtml: string, command: string): string =>
    `<dd class="justify-self-end max-sm:hidden">${copyButton(labelHtml, `data-copy="text" data-copy-text="${e(command)}" title="Copy: ${e(command)}"`)}</dd>`;

const heading = (text: string): string => `<h2 class="mt-5 font-normal italic text-ctp-overlay2 max-sm:mt-3">${e(text)}</h2>`;

/* ── # addresses ───────────────────────────────────────────────── */

const curlFor = (version: 4 | 6, host: string, hosts: ProbeHosts): string => {
    const own = version === 4 ? hosts.v4 : hosts.v6;
    return own ? `curl ${own}` : `curl -${version} ${host}`;
};

const addressLine = (version: 4 | 6, info: ProbeInfo, request: PageRequest, settings: PageSettings): string => {
    const isThis = info.ip_version === version;
    const value = isThis
        ? `${e(info.ip)} <span class="text-success">← this connection</span>`
        : '<span class="text-muted-foreground">checking…</span><noscript> <span class="text-muted-foreground">(needs JavaScript)</span></noscript>';
    return `<div class="${LINE}" data-ip-card="${version}" data-state="${isThis ? 'found' : 'checking'}" aria-live="polite">
<dt class="${KEY.address}">ipv${version}</dt>
<dd class="${VALUE}" data-ip-value>${value}</dd>
${commandCell(highlightCurl(`curl -${version}`), curlFor(version, request.host, settings.hosts))}
</div>`;
};

/* ── Field groups ──────────────────────────────────────────────── */

const fieldLine = (field: FieldSpec, info: ProbeInfo, host: string): string => {
    const value = info[field.key] ?? null;
    const local = field.key === 'timezone' && typeof value === 'string' ? ` <span class="text-muted-foreground" data-local-time="${e(value)}"></span>` : '';
    const path = fieldPath(field);
    return `<div class="${LINE}">
<dt class="${KEY[field.group]}" title="${e(field.label)}: ${e(field.description)}">${field.key}</dt>
<dd class="${VALUE}">${value === null ? NONE : e(fieldText(value))}${local}</dd>
${commandCell(highlightPath(path), `curl ${host}${path}`)}
</div>`;
};

const group = (name: FieldGroup, title: string, info: ProbeInfo, host: string): string => {
    const lines = FIELDS.filter((field) => field.group === name).map((field) => fieldLine(field, info, host)).join('\n');
    return `<section>${heading(title)}<dl>\n${lines}\n</dl></section>`;
};

/* ── Data for the script ───────────────────────────────────────── */

const otherLookup = (info: ProbeInfo, settings: PageSettings): { version: 4 | 6; url: string; kind: 'probe' | 'trace' } | null => {
    if (info.ip_version !== 4 && info.ip_version !== 6) return null;
    const version = info.ip_version === 4 ? 6 : 4;
    const own = version === 4 ? settings.hosts.v4 : settings.hosts.v6;
    return own ? { version, url: `https://${own}/ip?format=json`, kind: 'probe' } : { version, url: TRACE_URLS[version], kind: 'trace' };
};

const summaryLines = (info: ProbeInfo): string[] => {
    const join = (...parts: FieldValue[]): string => parts.filter((part) => part !== null && part !== '').join(', ');
    const country = info.country ?? info.country_code ?? null;
    const code = info.country_code ?? null;
    const countryPart = country !== null && code !== null && country !== code ? `${country} (${code})` : country;
    const asn = info.asn ?? null;
    return [
        `Location: ${join(info.city ?? null, info.region ?? null, countryPart) || 'unknown'}`,
        `Network: ${join(asn !== null ? `AS${asn}` : null, info.asn_org ?? null) || 'unknown'}`,
        `Connection: ${join(info.colo ?? null, info.http_protocol ?? null, info.tls_version ?? null) || 'unknown'}`,
    ];
};

// JSON inside a <script> block: `<` is escaped so no value can close it.
const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

/* ── Head, tabs, footer ────────────────────────────────────────── */

const analytics = (id: string | null): string =>
    id === null
        ? ''
        : `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${e(id)}');</script>`;

const tab = (view: string, active: boolean): string =>
    `<button type="button" role="tab" class="${TABS_TRIGGER}" data-view="${view}" data-state="${active ? 'active' : 'inactive'}" aria-selected="${active}" aria-controls="view-${view}">${view}</button>`;

const LINK = 'underline-offset-4 hover:text-foreground hover:underline';

const footer = (settings: PageSettings): string => {
    const lines = ['<p># location and network are estimates from Cloudflare\'s data for this connection</p>'];
    if (settings.privacyNote) lines.push('<p># this probe keeps no logs and runs no analytics</p>');
    if (settings.fullReportUrl !== null) {
        lines.push(`<p># full report: <a class="${LINK}" href="${e(settings.fullReportUrl)}">${e(new URL(settings.fullReportUrl).host)}</a></p>`);
    }
    lines.push(`<p># powered by <a class="${LINK}" href="${PROJECT_URL}">MyIP-Probe</a></p>`);
    return lines.join('\n');
};

/* ── About: what this is and how to call it ────────────────────── */

export const DESCRIPTION =
    "Your public IP address and connection details, as Cloudflare's edge sees this request. Open it in a browser, or call it from a terminal, a script or an AI agent.";

const about = (host: string): string => {
    const usage: readonly [string, string][] = [
        [`curl ${host}`, 'your IP, as plain text'],
        [`curl ${host}/json`, 'every field as JSON'],
        [`curl ${host}/<key>`, 'one field: its key with dashes, e.g. /city or /asn-org'],
        [`curl -4 ${host}`, 'ask over IPv4 (-6 for IPv6)'],
        [`curl ${host}/help`, 'every endpoint and option; AI agents: /llms.txt'],
    ];
    const lines = usage
        .map(([command, note]) => `<dt>${highlightCurl(command)}</dt><dd class="text-muted-foreground max-sm:mb-1"># ${e(note)}</dd>`)
        .join('\n');
    return `<section class="border-y px-4 py-4 sm:px-5" aria-label="About">
<p class="leading-6">${e(DESCRIPTION)}</p>
<dl class="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 text-xs leading-6 max-sm:grid-cols-1 max-sm:leading-5">
${lines}
</dl>
</section>`;
};

/* ── Your IP: the first thing under the title bar ──────────────── */

const yourIp = (info: ProbeInfo, version: 4 | 6 | null): string => {
    const copy = version === null ? '' : copyButton('copy', `data-copy="ip:${version}"`);
    return `<section class="px-4 pt-5 pb-6 sm:px-5" aria-labelledby="your-ip">
<h1 id="your-ip" class="text-xs font-normal text-muted-foreground">Your IP</h1>
<div class="mt-1 flex items-center justify-between gap-3"><p class="min-w-0 break-all text-2xl font-semibold sm:text-3xl">${info.ip === null ? NONE : e(info.ip)}</p>${copy}</div>
</section>`;
};

/* ── The json tab: /json in a box with its own copy button ─────── */

const jsonBox = (info: ProbeInfo, host: string): string => `<div id="view-json" role="tabpanel" class="rounded-lg border" data-view-panel="json" hidden>
<div class="flex items-center justify-between gap-3 border-b px-3 py-1.5 text-xs"><span class="min-w-0 truncate"><span class="text-ctp-overlay2">$</span> ${highlightCurl(`curl ${host}/json`)}</span>${copyButton('copy json', 'data-copy="json"')}</div>
<pre class="overflow-x-auto whitespace-pre p-3 text-xs leading-relaxed">${highlightJson(info)}</pre>
</div>`;

/* ── The page ──────────────────────────────────────────────────── */

export const renderPage = (info: ProbeInfo, request: PageRequest, settings: PageSettings): string => {
    const version = info.ip_version === 4 || info.ip_version === 6 ? info.ip_version : null;
    const data = {
        host: request.host,
        ips: { 4: version === 4 ? info.ip : null, 6: version === 6 ? info.ip : null },
        other: otherLookup(info, settings),
        summary: summaryLines(info),
        json: JSON.stringify(info, null, 2),
    };
    const groups = SECTIONS.map(({ group: name, heading: title }) => group(name, title, info, request.host)).join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${e(DESCRIPTION)}">
<meta name="author" content="${AUTHOR}">
<meta name="generator" content="MyIP-Probe">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1e1e2e">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${e(settings.siteName)}">
<meta property="og:title" content="${e(settings.siteName)}">
<meta property="og:description" content="${e(DESCRIPTION)}">
<meta property="og:url" content="https://${e(request.host)}/">
<meta name="twitter:card" content="summary">
<title>${e(settings.siteName)}</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URL}">
<link rel="alternate" type="application/json" href="/json">
<link rel="alternate" type="text/markdown" href="/llms.txt" title="Description for AI agents">
<link rel="service-desc" type="application/openapi+json" href="/openapi.json">
<link rel="help" type="text/plain" href="/help">
<style>${PAGE_CSS}</style>
<noscript><style>[role=tablist]{display:none}</style></noscript>
${analytics(settings.gaMeasurementId)}
</head>
<body class="min-h-dvh">
<div class="mx-auto max-w-3xl px-4 py-6 sm:py-12">
<div class="font-mono text-sm">
<header class="flex items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5">
<div class="flex min-w-0 items-center gap-2">${LOGO_SVG}<span class="truncate font-semibold">${e(settings.siteName)}</span></div>
<div role="tablist" aria-label="View" class="${TABS_LIST}">${tab('text', true)}${tab('json', false)}</div>
</header>
${yourIp(info, version)}
${about(request.host)}
<main class="px-4 py-4 leading-7 max-sm:text-[13px] max-sm:leading-6 sm:px-5">
<div id="view-text" role="tabpanel" class="[&>section:first-child>h2]:mt-0" data-view-panel="text">
<section>${heading('# addresses')}<dl>
${addressLine(4, info, request, settings)}
${addressLine(6, info, request, settings)}
</dl></section>
${groups}
<div class="mt-5">${copyButton('copy summary', 'data-copy="summary"', '-ml-1.5')}</div>
</div>
${jsonBox(info, request.host)}
</main>
<footer class="space-y-0.5 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5">
${footer(settings)}
</footer>
</div>
</div>
<script type="application/json" id="probe-data">${scriptJson(data)}</script>
<script>${PAGE_SCRIPT}</script>
</body>
</html>
`;
};
