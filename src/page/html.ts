// HTML helpers shared by the page renderers.

const ESCAPES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export const escapeHtml = (value: unknown): string =>
    value === null || value === undefined ? '' : String(value).replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
