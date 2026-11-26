// The caller's address, taken only from headers Cloudflare sets itself.
// With Pseudo IPv4 in its "overwrite" mode, Cloudflare puts a class E
// (240.0.0.0/4) stand-in into CF-Connecting-IP and moves the real IPv6
// address to CF-Connecting-IPv6; only then is the latter read.

const isPseudoIPv4 = (ip: string): boolean => {
    const first = Number(ip.split('.')[0]);
    return !ip.includes(':') && first >= 240 && first <= 255;
};

export const clientIp = (headers: Headers): string | null => {
    const ip = headers.get('CF-Connecting-IP')?.trim();
    if (!ip) return null;
    const ipv6 = headers.get('CF-Connecting-IPv6')?.trim();
    return isPseudoIPv4(ip) && ipv6 ? ipv6 : ip;
};
