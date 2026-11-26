// Probe options and how a deployment's environment variables map onto them.
// A wrapper builds ProbeOptions directly; the stand-alone Worker reads them
// from its variables through optionsFromEnv, which reports every problem at
// once instead of guessing.

export interface ProbeHosts {
    // Hostname reachable over both versions, where the page lives, e.g.
    // `probe.example.com`. Lets the IPv4 / IPv6 hosts answer the page's
    // cross-origin lookups.
    readonly main?: string;
    // Hostname reachable over IPv4 only, e.g. `probe-4.example.com`.
    readonly v4?: string;
    // Hostname reachable over IPv6 only.
    readonly v6?: string;
}

export interface ProbeCors {
    // Exact origins (`https://app.example.com`), or `*` for any origin.
    readonly origins?: readonly string[] | '*';
    // Domains whose https origins are allowed, the domain itself and every
    // subdomain.
    readonly rootDomains?: readonly string[];
}

export interface ProbeOptions {
    // Serve the page at `/` to browsers; when false, `/` answers as an API only.
    readonly page?: boolean;
    // Name shown in the page header and title.
    readonly siteName?: string;
    // Google Analytics measurement id (`G-…`); the page loads no analytics
    // without one.
    readonly gaMeasurementId?: string;
    // The page footer's "full report" link; null hides it.
    readonly fullReportUrl?: string | null;
    // The page's "keeps no logs and runs no analytics" line. Defaults to on
    // only without a GA id; a deployment that records requests must turn it off.
    readonly privacyNote?: boolean;
    // The `note` line of the legacy `/geo` answer.
    readonly legacyNote?: string;
    readonly hosts?: ProbeHosts;
    readonly cors?: ProbeCors;
}

export type OptionsResult = { ok: true; options: ProbeOptions } | { ok: false; problems: string[] };

export const DEFAULT_SITE_NAME = 'MyIP Probe';
export const DEFAULT_FULL_REPORT_URL = 'https://ipcheck.ing';

export const ENV_KEYS = {
    page: 'PROBE_PAGE',
    siteName: 'PROBE_SITE_NAME',
    gaMeasurementId: 'PROBE_GA_ID',
    fullReportUrl: 'PROBE_FULL_REPORT_URL',
    privacyNote: 'PROBE_PRIVACY_NOTE',
    legacyNote: 'PROBE_LEGACY_NOTE',
    hostMain: 'PROBE_HOST',
    hostV4: 'PROBE_HOST_V4',
    hostV6: 'PROBE_HOST_V6',
    origins: 'PROBE_ALLOWED_ORIGINS',
    rootDomains: 'PROBE_ALLOWED_ROOT_DOMAINS',
} as const;

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

export const isHostname = (value: string): boolean => HOSTNAME.test(value);

// An origin is scheme + host (+ port) and nothing else.
export const isOrigin = (value: string): boolean => {
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
    } catch {
        return false;
    }
};

const list = (value: string): string[] =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

// A variable counts as set only when it is a non-blank string.
const read = (env: Readonly<Record<string, unknown>>, key: string): string | undefined => {
    const value = env[key];
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

export const optionsFromEnv = (env: Readonly<Record<string, unknown>>): OptionsResult => {
    const problems: string[] = [];
    let options: ProbeOptions = {};

    const page = read(env, ENV_KEYS.page);
    if (page !== undefined) {
        if (page === 'true' || page === 'false') options = { ...options, page: page === 'true' };
        else problems.push(`${ENV_KEYS.page} must be "true" or "false", got "${page}"`);
    }

    const privacy = read(env, ENV_KEYS.privacyNote);
    if (privacy !== undefined) {
        if (privacy === 'true' || privacy === 'false') options = { ...options, privacyNote: privacy === 'true' };
        else problems.push(`${ENV_KEYS.privacyNote} must be "true" or "false", got "${privacy}"`);
    }

    const siteName = read(env, ENV_KEYS.siteName);
    if (siteName !== undefined) options = { ...options, siteName };

    const ga = read(env, ENV_KEYS.gaMeasurementId);
    if (ga !== undefined) {
        if (/^G-[A-Z0-9]+$/.test(ga)) options = { ...options, gaMeasurementId: ga };
        else problems.push(`${ENV_KEYS.gaMeasurementId} must be a measurement id such as G-ABC123, got "${ga}"`);
    }

    const report = read(env, ENV_KEYS.fullReportUrl);
    if (report === 'off') options = { ...options, fullReportUrl: null };
    else if (report !== undefined) {
        if (/^https:\/\/[^\s"<>]+$/.test(report) && URL.canParse(report)) options = { ...options, fullReportUrl: report };
        else problems.push(`${ENV_KEYS.fullReportUrl} must be an https URL or "off", got "${report}"`);
    }

    const note = read(env, ENV_KEYS.legacyNote);
    if (note !== undefined) options = { ...options, legacyNote: note };

    let hosts: ProbeHosts = {};
    const hostKeys = [[ENV_KEYS.hostMain, 'main'], [ENV_KEYS.hostV4, 'v4'], [ENV_KEYS.hostV6, 'v6']] as const;
    for (const [key, role] of hostKeys) {
        const host = read(env, key)?.toLowerCase();
        if (host === undefined) continue;
        if (isHostname(host)) hosts = { ...hosts, [role]: host };
        else problems.push(`${key} must be a bare hostname such as probe.example.com, got "${host}"`);
    }
    const named = [hosts.main, hosts.v4, hosts.v6].filter((host) => host !== undefined);
    if (new Set(named).size !== named.length) {
        problems.push(`${hostKeys.map(([key]) => key).join(', ')} must be different hostnames`);
    }
    if (Object.keys(hosts).length > 0) options = { ...options, hosts };

    let cors: ProbeCors = {};
    const origins = read(env, ENV_KEYS.origins);
    if (origins === '*') cors = { ...cors, origins: '*' };
    else if (origins !== undefined) {
        const entries = list(origins);
        const invalid = entries.filter((entry) => !isOrigin(entry));
        if (invalid.length > 0) {
            problems.push(`${ENV_KEYS.origins} takes "*" or origins such as https://app.example.com; not valid: ${invalid.join(', ')}`);
        } else cors = { ...cors, origins: entries };
    }
    const rootDomains = read(env, ENV_KEYS.rootDomains);
    if (rootDomains !== undefined) {
        const entries = list(rootDomains.toLowerCase());
        const invalid = entries.filter((entry) => !isHostname(entry));
        if (invalid.length > 0) {
            problems.push(`${ENV_KEYS.rootDomains} takes domains such as example.com; not valid: ${invalid.join(', ')}`);
        } else cors = { ...cors, rootDomains: entries };
    }
    if (Object.keys(cors).length > 0) options = { ...options, cors };

    return problems.length > 0 ? { ok: false, problems } : { ok: true, options };
};
