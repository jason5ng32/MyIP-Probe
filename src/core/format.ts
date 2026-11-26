// Output-format resolution. A route lists the formats it can answer in; an
// explicit `?format=` picks one of them, otherwise the route's default
// applies. Only the legacy routes look at the client: `/` and `/geo` answer
// curl in text, and `/` answers a browser navigation with the page.

export type Format = 'text' | 'json' | 'html';

const FORMATS: readonly Format[] = ['text', 'json', 'html'];

export type FormatDefault = Format | 'legacy-root' | 'legacy-geo';

export interface FormatRule {
    readonly allowed: readonly Format[];
    readonly fallback: FormatDefault;
}

export type FormatResult = { ok: true; format: Format } | { ok: false; requested: string };

const isFormat = (value: string): value is Format => (FORMATS as readonly string[]).includes(value);

const isCurl = (headers: Headers): boolean => (headers.get('User-Agent') ?? '').includes('curl');

const wantsHtml = (headers: Headers): boolean => (headers.get('Accept') ?? '').includes('text/html');

const fallbackFormat = (fallback: FormatDefault, headers: Headers): Format => {
    if (fallback === 'legacy-root') return isCurl(headers) ? 'text' : wantsHtml(headers) ? 'html' : 'json';
    if (fallback === 'legacy-geo') return isCurl(headers) ? 'text' : 'json';
    return fallback;
};

export const resolveFormat = (rule: FormatRule, url: URL, headers: Headers): FormatResult => {
    const requested = url.searchParams.get('format');
    if (requested === null) return { ok: true, format: fallbackFormat(rule.fallback, headers) };
    const normalized = requested.trim().toLowerCase();
    if (isFormat(normalized) && rule.allowed.includes(normalized)) return { ok: true, format: normalized };
    return { ok: false, requested };
};

// The format an error goes out in when the requested one was unusable.
export const errorFormat = (headers: Headers): Format => (isCurl(headers) ? 'text' : 'json');
