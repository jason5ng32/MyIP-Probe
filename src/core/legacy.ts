// The frozen contract of the original 4./6./64.ipcheck.ing service for `/`
// and `/geo`. Scripts in the wild parse these bodies, so they reproduce the
// original output byte for byte — including `undefined` lines, `N/A`, the
// `Timezone` key and bare content types — as pinned by
// tests/fixtures/legacy/legacy.json. Never change it; new behaviour belongs
// to the new endpoints.

import type { Connection } from './connection.ts';
import { respond } from './respond.ts';

export const DEFAULT_LEGACY_NOTE = 'For more detailed IP information, visit https://ipcheck.ing';

const LEGACY_TEXT = 'text/plain';
const LEGACY_JSON = 'application/json';

const flagOf = (code: string | undefined): string | undefined => {
    if (!code || !/^[A-Z]{2}$/.test(code)) return undefined;
    return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
};

export const legacyRoot = (connection: Connection, asText: boolean): Response =>
    asText
        ? respond(`${connection.ip}\n`, LEGACY_TEXT)
        : respond(JSON.stringify({ ip: connection.ip }), LEGACY_JSON);

export const legacyGeo = (connection: Connection, asText: boolean, note: string): Response => {
    const cf = connection.cf ?? {};
    const geo = {
        ip: connection.ip,
        city: cf.city,
        region: cf.region || 'N/A',
        country: cf.country,
        flag: flagOf(cf.country),
        latitude: cf.latitude,
        longitude: cf.longitude,
        org: cf.asOrganization,
        asn: cf.asn ? `AS${cf.asn}` : undefined,
        Timezone: cf.timezone,
        note,
    };
    if (!asText) return respond(JSON.stringify(geo), LEGACY_JSON);

    // Template literals print a missing value as `undefined`, as the original did.
    const body =
        `IP: ${geo.ip}\n` +
        `City: ${geo.city}\n` +
        `Region: ${geo.region}\n` +
        `Country: ${geo.country}\n` +
        `Flag: ${geo.flag}\n` +
        `Latitude: ${geo.latitude}\n` +
        `Longitude: ${geo.longitude}\n` +
        `Org: ${geo.org}\n` +
        `Timezone: ${geo.Timezone}\n` +
        `ASN: ${geo.asn}\n` +
        `Note: ${geo.note}\n`;
    return respond(body, LEGACY_TEXT);
};
