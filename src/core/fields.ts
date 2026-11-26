// The field registry: every value the probe reports, in output order. The
// JSON body, the single-field endpoints and (later) the help text, OpenAPI
// document, llms.txt and page are all generated from this list.

import type { CfData, Connection } from './connection.ts';

export type FieldValue = string | number | boolean | null;

export type FieldGroup = 'address' | 'location' | 'network' | 'connection';

// JSON type of a field's value when present; any field may also be null.
export type FieldType = 'string' | 'integer' | 'number' | 'boolean';

export interface FieldSpec {
    readonly key: string;
    readonly group: FieldGroup;
    readonly type: FieldType;
    readonly label: string;
    readonly description: string;
    readonly read: (connection: Connection) => FieldValue;
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

// Cloudflare reports `XX` for an unknown country and `T1` for Tor; neither
// has a country name.
const countryName = (code: string | undefined): string | null => {
    if (!code || !/^[A-Z]{2}$/.test(code) || code === 'XX') return null;
    return regionNames.of(code) ?? null;
};

const text = (value: string | undefined): string | null => (value ? value : null);

const decimal = (value: string | undefined): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const cfOf = (connection: Connection): CfData => connection.cf ?? {};

export const FIELDS: readonly FieldSpec[] = [
    {
        key: 'ip',
        group: 'address',
        type: 'string',
        label: 'IP address',
        description: 'Public IP address the request came from.',
        read: (c) => c.ip,
    },
    {
        key: 'ip_version',
        group: 'address',
        type: 'integer',
        label: 'IP version',
        description: 'IP version of the request: 4 or 6.',
        read: (c) => (c.ip === null ? null : c.ip.includes(':') ? 6 : 4),
    },
    {
        key: 'city',
        group: 'location',
        type: 'string',
        label: 'City',
        description: 'Estimated city.',
        read: (c) => text(cfOf(c).city),
    },
    {
        key: 'region',
        group: 'location',
        type: 'string',
        label: 'Region',
        description: 'Estimated region, state or province.',
        read: (c) => text(cfOf(c).region),
    },
    {
        key: 'region_code',
        group: 'location',
        type: 'string',
        label: 'Region code',
        description: 'Code of the estimated region (ISO 3166-2 subdivision part, where known).',
        read: (c) => text(cfOf(c).regionCode),
    },
    {
        key: 'postal_code',
        group: 'location',
        type: 'string',
        label: 'Postal code',
        description: 'Estimated postal code.',
        read: (c) => text(cfOf(c).postalCode),
    },
    {
        key: 'country',
        group: 'location',
        type: 'string',
        label: 'Country',
        description: 'English name of the estimated country.',
        read: (c) => countryName(cfOf(c).country),
    },
    {
        key: 'country_code',
        group: 'location',
        type: 'string',
        label: 'Country code',
        description: 'ISO 3166-1 alpha-2 code of the estimated country; XX when unknown, T1 for Tor.',
        read: (c) => text(cfOf(c).country),
    },
    {
        key: 'continent_code',
        group: 'location',
        type: 'string',
        label: 'Continent code',
        description: 'Two-letter code of the estimated continent (AF, AN, AS, EU, NA, OC, SA).',
        read: (c) => text(cfOf(c).continent),
    },
    {
        key: 'is_eu',
        group: 'location',
        type: 'boolean',
        label: 'In the EU',
        description: 'Whether the estimated country is a European Union member.',
        read: (c) => {
            const cf = cfOf(c);
            return cf.country ? cf.isEUCountry === '1' : null;
        },
    },
    {
        key: 'latitude',
        group: 'location',
        type: 'number',
        label: 'Latitude',
        description: 'Estimated latitude in decimal degrees.',
        read: (c) => decimal(cfOf(c).latitude),
    },
    {
        key: 'longitude',
        group: 'location',
        type: 'number',
        label: 'Longitude',
        description: 'Estimated longitude in decimal degrees.',
        read: (c) => decimal(cfOf(c).longitude),
    },
    {
        key: 'timezone',
        group: 'location',
        type: 'string',
        label: 'Time zone',
        description: 'IANA time zone of the estimated location.',
        read: (c) => text(cfOf(c).timezone),
    },
    {
        key: 'asn',
        group: 'network',
        type: 'integer',
        label: 'ASN',
        description: 'Autonomous system number of the network the IP belongs to.',
        read: (c) => cfOf(c).asn || null,
    },
    {
        key: 'asn_org',
        group: 'network',
        type: 'string',
        label: 'AS organization',
        description: 'Organization that operates the autonomous system.',
        read: (c) => text(cfOf(c).asOrganization),
    },
    {
        key: 'colo',
        group: 'connection',
        type: 'string',
        label: 'Edge location',
        description: 'IATA-style code of the Cloudflare data center that answered.',
        read: (c) => text(cfOf(c).colo),
    },
    {
        key: 'http_protocol',
        group: 'connection',
        type: 'string',
        label: 'HTTP protocol',
        description: 'HTTP version of the request, such as HTTP/2 or HTTP/3.',
        read: (c) => text(cfOf(c).httpProtocol),
    },
    {
        key: 'tls_version',
        group: 'connection',
        type: 'string',
        label: 'TLS version',
        description: 'TLS version of the connection, such as TLSv1.3.',
        read: (c) => text(cfOf(c).tlsVersion),
    },
    {
        key: 'tls_cipher',
        group: 'connection',
        type: 'string',
        label: 'TLS cipher',
        description: 'Cipher suite of the TLS connection.',
        read: (c) => text(cfOf(c).tlsCipher),
    },
    {
        key: 'tcp_rtt_ms',
        group: 'connection',
        type: 'integer',
        label: 'TCP round trip',
        description: 'Round-trip time between the client and the edge, in milliseconds; null over HTTP/3, which does not run on TCP.',
        // Cloudflare reports 0 when it has no TCP measurement.
        read: (c) => cfOf(c).clientTcpRtt || null,
    },
];

// Single-field endpoint of a field: its key with dashes, e.g. `/asn-org`.
export const fieldPath = (field: FieldSpec): string => '/' + field.key.replaceAll('_', '-');

const FIELDS_BY_PATH: ReadonlyMap<string, FieldSpec> = new Map(FIELDS.map((field) => [fieldPath(field), field]));

export const fieldForPath = (path: string): FieldSpec | undefined => FIELDS_BY_PATH.get(path);

export type ProbeInfo = Record<string, FieldValue>;

// Every field's value, keys in registry order.
export const readInfo = (connection: Connection): ProbeInfo =>
    Object.fromEntries(FIELDS.map((field) => [field.key, field.read(connection)]));

// What a single-field endpoint says when this connection has no value.
export const notAvailableMessage = (field: FieldSpec): string => `${field.label} is not available for this connection`;

// Plain-text form of one value: a single line, no decoration.
export const fieldText = (value: Exclude<FieldValue, null>): string => String(value);
