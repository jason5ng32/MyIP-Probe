// Cross-origin rules. A request without an Origin (curl, same-origin) gets
// `*`. A cross-origin request is allowed when its origin is listed, sits
// under an allowed root domain over https, or is one of the probe's own
// hostnames — the page on the main host reads the IPv4 / IPv6 hosts. A refused
// origin gets no Access-Control-Allow-Origin at all.

import type { ProbeOptions } from '../options.ts';

export const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';

const hostnameOf = (origin: string): { protocol: string; hostname: string } | null => {
    try {
        const { protocol, hostname } = new URL(origin);
        return { protocol, hostname };
    } catch {
        return null;
    }
};

export const isOriginAllowed = (origin: string, requestHost: string, options: ProbeOptions): boolean => {
    const origins = options.cors?.origins;
    if (origins === '*') return true;
    if (origins?.includes(origin)) return true;

    const parsed = hostnameOf(origin);
    if (!parsed) return false;
    const ownHosts = [requestHost, options.hosts?.main, options.hosts?.v4, options.hosts?.v6];
    if (ownHosts.includes(parsed.hostname)) return true;

    if (parsed.protocol !== 'https:') return false;
    return (options.cors?.rootDomains ?? []).some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain),
    );
};

export const corsHeaders = (origin: string | null, requestHost: string, options: ProbeOptions): Record<string, string> => {
    if (origin === null) return { 'Access-Control-Allow-Origin': '*' };
    if (!isOriginAllowed(origin, requestHost, options)) return { Vary: 'Origin' };
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
    };
};
