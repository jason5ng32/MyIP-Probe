// What the probe knows about one caller: the address the request came from
// and the subset of Cloudflare's `request.cf` it reads. Everything else in
// the core is derived from this.

export type CfData = Partial<
    Pick<
        IncomingRequestCfProperties,
        | 'asn'
        | 'asOrganization'
        | 'clientTcpRtt'
        | 'colo'
        | 'httpProtocol'
        | 'tlsVersion'
        | 'tlsCipher'
        | 'country'
        | 'isEUCountry'
        | 'continent'
        | 'city'
        | 'postalCode'
        | 'latitude'
        | 'longitude'
        | 'timezone'
        | 'region'
        | 'regionCode'
    >
>;

export interface Connection {
    ip: string | null;
    cf: CfData | undefined;
}
