// What the generated docs need to know about the deployment answering them:
// the hostname it was asked on and its IPv4 / IPv6 hostnames, if any.

import type { ProbeHosts } from '../../options.ts';

export interface DocsContext {
    readonly host: string;
    readonly hosts: ProbeHosts;
}

// How to ask over one IP version: the dedicated host when configured,
// else curl's -4 / -6 against this one.
export const versionCommand = (version: 4 | 6, context: DocsContext): string => {
    const own = version === 4 ? context.hosts.v4 : context.hosts.v6;
    return own ? `curl ${own}` : `curl -${version} ${context.host}`;
};
