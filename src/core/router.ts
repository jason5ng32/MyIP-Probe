// Maps a request path to its response. Platform-free: it takes a standard
// Request plus the caller's Connection, so the Worker entry and the tests
// drive it the same way.

import type { ProbeHosts } from '../options.ts';
import type { Connection } from './connection.ts';
import { renderHelp } from './docs/help.ts';
import { renderLlmsTxt } from './docs/llms.ts';
import { renderOpenApi } from './docs/openapi.ts';
import { fieldForPath, fieldText, notAvailableMessage, readInfo, type FieldSpec, type ProbeInfo } from './fields.ts';
import { errorFormat, resolveFormat, type Format, type FormatRule } from './format.ts';
import { DEFAULT_LEGACY_NOTE, legacyGeo, legacyRoot } from './legacy.ts';
import { HTML_TYPE, MARKDOWN_TYPE, errorResponse, jsonResponse, respond, textResponse } from './respond.ts';

export interface RouterOptions {
    // Renders the page served at `/` to a browser, given the hostname it was
    // requested on; without it, `/` answers as an API only (curl gets text,
    // everything else JSON).
    readonly renderPage?: (info: ProbeInfo, host: string) => string;
    // The `note` line of the legacy `/geo` answer.
    readonly legacyNote?: string;
    // The IPv4 / IPv6 hostnames the docs mention.
    readonly hosts?: ProbeHosts;
}

type Route =
    | { kind: 'root' }
    | { kind: 'json' }
    | { kind: 'geo' }
    | { kind: 'help' }
    | { kind: 'llms' }
    | { kind: 'openapi' }
    | { kind: 'health' }
    | { kind: 'field'; field: FieldSpec };

const RULES: Record<Route['kind'], FormatRule> = {
    root: { allowed: ['text', 'json', 'html'], fallback: 'legacy-root' },
    json: { allowed: ['json'], fallback: 'json' },
    geo: { allowed: ['text', 'json'], fallback: 'legacy-geo' },
    help: { allowed: ['text'], fallback: 'text' },
    llms: { allowed: ['text'], fallback: 'text' },
    openapi: { allowed: ['json'], fallback: 'json' },
    health: { allowed: ['json', 'text'], fallback: 'json' },
    field: { allowed: ['text', 'json'], fallback: 'text' },
};

const FIXED_ROUTES: Readonly<Record<string, Route>> = {
    '/': { kind: 'root' },
    '/json': { kind: 'json' },
    '/geo': { kind: 'geo' },
    '/help': { kind: 'help' },
    '/llms.txt': { kind: 'llms' },
    '/openapi.json': { kind: 'openapi' },
    '/health': { kind: 'health' },
};

// Paths answered by something other than a field; no field may take one.
export const FIXED_PATHS: readonly string[] = Object.keys(FIXED_ROUTES);

// Without a page, `/` resolves exactly like `/geo`: curl → text, else JSON.
const API_ONLY_ROOT: FormatRule = { allowed: ['text', 'json'], fallback: 'legacy-geo' };

const ruleFor = (route: Route, options: RouterOptions): FormatRule =>
    route.kind === 'root' && !options.renderPage ? API_ONLY_ROOT : RULES[route.kind];

const matchRoute = (path: string): Route | undefined => {
    const fixed = FIXED_ROUTES[path];
    if (fixed) return fixed;
    const field = fieldForPath(path);
    return field ? { kind: 'field', field } : undefined;
};

const fieldResponse = (field: FieldSpec, connection: Connection, format: Format): Response => {
    const value = field.read(connection);
    if (value === null) {
        return errorResponse(404, 'not_available', notAvailableMessage(field), format);
    }
    return format === 'json' ? jsonResponse({ [field.key]: value }) : textResponse(fieldText(value));
};

export const handleProbeRequest = (request: Request, connection: Connection, options: RouterOptions): Response => {
    const url = new URL(request.url);
    const route = matchRoute(url.pathname);
    if (!route) return errorResponse(404, 'not_found', 'Not found', errorFormat(request.headers));

    const rule = ruleFor(route, options);
    const resolved = resolveFormat(rule, url, request.headers);
    if (!resolved.ok) {
        const allowed = rule.allowed.join(', ');
        return errorResponse(400, 'bad_format', `Unsupported format "${resolved.requested}"; use one of: ${allowed}`, errorFormat(request.headers));
    }
    const { format } = resolved;
    const docs = () => ({ host: url.hostname, hosts: options.hosts ?? {} });

    switch (route.kind) {
        case 'root':
            return format === 'html' && options.renderPage
                ? respond(options.renderPage(readInfo(connection), url.hostname), HTML_TYPE)
                : legacyRoot(connection, format === 'text');
        case 'geo':
            return legacyGeo(connection, format === 'text', options.legacyNote ?? DEFAULT_LEGACY_NOTE);
        case 'json':
            return jsonResponse(readInfo(connection));
        case 'help':
            return textResponse(renderHelp(docs()));
        case 'llms':
            return respond(renderLlmsTxt(docs()), MARKDOWN_TYPE);
        case 'openapi':
            return jsonResponse(renderOpenApi(docs()));
        case 'health':
            return format === 'json' ? jsonResponse({ status: 'ok' }) : textResponse('ok');
        case 'field':
            return fieldResponse(route.field, connection, format);
    }
};
