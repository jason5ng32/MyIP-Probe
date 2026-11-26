// Builds the Wrangler configuration for the test deployment from .env
// values, refusing anything that could land on the wrong Worker or zone.
// - The main host is a Custom Domain: Cloudflare creates its proxied DNS
//   record and its certificate on deploy.
// - The IPv4 / IPv6 hosts are plain routes: their DNS-only A / AAAA records
//   are made by hand, and their TLS comes from the zone's own certificate,
//   which only covers names one level below the zone (`*.zone`).
// - Every route names its zone: zones on some plans refuse one without it,
//   and `wrangler deploy --route` cannot pass it.

import { ENV_KEYS, isHostname } from '../src/options.ts';

// The parts of wrangler.toml the test deployment inherits.
export interface BaseConfig {
    readonly main: string;
    readonly compatibility_date: string;
}

export interface DevDeployConfig extends BaseConfig {
    readonly name: string;
    readonly workers_dev: true;
    readonly routes: readonly { readonly pattern: string; readonly zone_name: string; readonly custom_domain?: true }[];
    readonly vars: Readonly<Record<string, string>>;
}

export type DevDeployResult = { ok: true; config: DevDeployConfig; warnings: string[] } | { ok: false; problems: string[] };

// The Worker name in wrangler.toml; the test Worker must never take it.
export const DEFAULT_WORKER_NAME = 'myip-probe';

// Runtime variables forwarded to the Worker as they are.
const FORWARDED = Object.values(ENV_KEYS);

const inZone = (host: string, zone: string): boolean => host === zone || host.endsWith('.' + zone);

// Whether the zone's `*.zone` certificate covers the host.
const underZoneWildcard = (host: string, zone: string): boolean =>
    host.endsWith('.' + zone) && !host.slice(0, -zone.length - 1).includes('.');

// Reads `main` and `compatibility_date` from wrangler.toml's top level.
export const baseConfigFromToml = (toml: string): BaseConfig | null => {
    const field = (key: string): string | undefined => toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];
    const main = field('main');
    const date = field('compatibility_date');
    return main && date ? { main, compatibility_date: date } : null;
};

export const devDeployConfig = (env: Readonly<Record<string, string | undefined>>, base: BaseConfig): DevDeployResult => {
    const problems: string[] = [];
    const value = (key: string): string | undefined => {
        const raw = env[key]?.trim();
        return raw ? raw : undefined;
    };

    if (!value('CLOUDFLARE_ACCOUNT_ID')) problems.push('CLOUDFLARE_ACCOUNT_ID is required, so the deploy cannot reach another account');

    const name = value('PROBE_DEV_WORKER_NAME');
    if (!name) problems.push('PROBE_DEV_WORKER_NAME is required');
    else if (name === DEFAULT_WORKER_NAME) problems.push(`PROBE_DEV_WORKER_NAME must differ from "${DEFAULT_WORKER_NAME}"`);

    const zone = value('PROBE_DEV_ZONE')?.toLowerCase();
    if (!zone) problems.push('PROBE_DEV_ZONE is required');
    else if (!isHostname(zone)) problems.push(`PROBE_DEV_ZONE must be a domain, got "${zone}"`);

    const hosts: string[] = [];
    const warnings: string[] = [];
    for (const key of ['PROBE_DEV_HOST', ENV_KEYS.hostV4, ENV_KEYS.hostV6]) {
        const host = value(key)?.toLowerCase();
        if (!host) {
            if (key === 'PROBE_DEV_HOST') problems.push('PROBE_DEV_HOST is required');
            continue;
        }
        if (!isHostname(host)) problems.push(`${key} must be a bare hostname, got "${host}"`);
        else if (zone && !inZone(host, zone)) problems.push(`${key} (${host}) is outside PROBE_DEV_ZONE (${zone})`);
        else {
            hosts.push(host);
            if (key !== 'PROBE_DEV_HOST' && zone && !underZoneWildcard(host, zone)) {
                warnings.push(`${key} (${host}) is not directly under ${zone}; the zone's *.${zone} certificate won't cover it, so HTTPS fails unless the zone has a certificate for that name`);
            }
        }
    }

    if (problems.length > 0 || !name || !zone) return { ok: false, problems };

    // The test host is the Worker's main host unless .env names another.
    const vars: Record<string, string> = { [ENV_KEYS.hostMain]: hosts[0] ?? '' };
    for (const key of FORWARDED) {
        const forwarded = value(key);
        if (forwarded !== undefined) vars[key] = forwarded;
    }
    return {
        ok: true,
        config: {
            ...base,
            name,
            workers_dev: true,
            routes: hosts.map((host, index) =>
                index === 0 ? { pattern: host, zone_name: zone, custom_domain: true } : { pattern: `${host}/*`, zone_name: zone },
            ),
            vars,
        },
        warnings,
    };
};
