// Pretty-printed JSON as HTML, coloured with Catppuccin's usual code roles:
// keys blue, strings green, numbers peach, true / false / null mauve.
// The text is exactly JSON.stringify(value, null, 2); only spans are added.

import { escapeHtml as e } from './html.ts';

// A string (then optionally the colon that makes it a key), a literal, or a number.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

const span = (className: string, text: string): string => `<span class="${className}">${e(text)}</span>`;

export const highlightJson = (value: unknown): string => {
    const json = JSON.stringify(value, null, 2);
    let html = '';
    let last = 0;
    for (const match of json.matchAll(TOKEN)) {
        html += e(json.slice(last, match.index));
        const [whole, string, colon, literal, number] = match;
        if (string !== undefined) html += colon === undefined ? span('text-ctp-green', string) : span('text-ctp-blue', string) + e(colon);
        else if (literal !== undefined) html += span('text-ctp-mauve', literal);
        else if (number !== undefined) html += span('text-ctp-peach', number);
        last = match.index + whole.length;
    }
    return html + e(json.slice(last));
};
