// createProbe: the public entry point. It turns ProbeOptions into a fetch
// handler a Worker can call directly — or several, when a wrapper serves
// different hostnames with different options.

import { clientIp } from './core/client-ip.ts';
import type { Connection } from './core/connection.ts';
import { ALLOWED_METHODS, corsHeaders } from './core/cors.ts';
import { errorFormat } from './core/format.ts';
import { errorResponse } from './core/respond.ts';
import { handleProbeRequest, type RouterOptions } from './core/router.ts';
import { DEFAULT_FULL_REPORT_URL, DEFAULT_SITE_NAME, type ProbeOptions } from './options.ts';
import { renderPage, type PageSettings } from './page/page.ts';

export interface Probe {
    readonly fetch: (request: Request) => Response;
}

const connectionOf = (request: Request): Connection => ({
    ip: clientIp(request.headers),
    // `Request.cf` is typed for both directions; on an incoming request it
    // always holds the incoming properties.
    cf: request.cf as IncomingRequestCfProperties | undefined,
});

// Headers are copied onto a fresh Response; a HEAD answer drops the body.
const finish = (response: Response, extra: Record<string, string>, head: boolean): Response => {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(extra)) headers.set(name, value);
    return new Response(head ? null : response.body, { status: response.status, headers });
};

const pageSettings = (options: ProbeOptions): PageSettings => {
    const ga = options.gaMeasurementId ?? null;
    return {
        siteName: options.siteName ?? DEFAULT_SITE_NAME,
        hosts: options.hosts ?? {},
        gaMeasurementId: ga,
        fullReportUrl: options.fullReportUrl === undefined ? DEFAULT_FULL_REPORT_URL : options.fullReportUrl,
        privacyNote: options.privacyNote ?? ga === null,
    };
};

export const createProbe = (options: ProbeOptions = {}): Probe => {
    const settings = pageSettings(options);
    const routerOptions: RouterOptions = {
        ...(options.page === false ? {} : { renderPage: (info, host) => renderPage(info, { host }, settings) }),
        ...(options.legacyNote === undefined ? {} : { legacyNote: options.legacyNote }),
        ...(options.hosts === undefined ? {} : { hosts: options.hosts }),
    };

    return {
        fetch: (request) => {
            const url = new URL(request.url);
            const cors = corsHeaders(request.headers.get('Origin'), url.hostname, options);

            if (request.method === 'OPTIONS') {
                return new Response(null, { status: 204, headers: { ...cors, Allow: ALLOWED_METHODS, 'Cache-Control': 'no-store' } });
            }
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                const refused = errorResponse(405, 'method_not_allowed', `Method ${request.method} is not allowed`, errorFormat(request.headers));
                return finish(refused, { ...cors, Allow: ALLOWED_METHODS }, false);
            }

            const response = handleProbeRequest(request, connectionOf(request), routerOptions);
            return finish(response, cors, request.method === 'HEAD');
        },
    };
};
