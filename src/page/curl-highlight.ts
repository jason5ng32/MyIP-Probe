// A curl command as HTML, each part in its Catppuccin role: the command
// mauve, flags peach, the host green, the path sapphire, the query peach,
// placeholders such as <key> overlay2 italic. The text is unchanged; only
// spans are added.

import { escapeHtml as e } from './html.ts';

const span = (className: string, text: string): string => (text === '' ? '' : `<span class="${className}">${e(text)}</span>`);

// `/path?query`, with <placeholders> picked out of the path.
const pathHtml = (path: string): string => {
    const queryAt = path.indexOf('?');
    const pathPart = queryAt === -1 ? path : path.slice(0, queryAt);
    const query = queryAt === -1 ? '' : path.slice(queryAt);
    const pieces = pathPart.split(/(<[^>]+>)/).map((piece) =>
        piece.startsWith('<') ? span('italic text-ctp-overlay2', piece) : span('text-ctp-sapphire', piece),
    );
    return pieces.join('') + span('text-ctp-peach', query);
};

// One word of the command: the program, a flag, or a host with its path.
const wordHtml = (word: string, index: number): string => {
    if (index === 0) return span('text-ctp-mauve', word);
    if (word.startsWith('-')) return span('text-ctp-peach', word);
    const slashAt = word.indexOf('/');
    const host = slashAt === -1 ? word : word.slice(0, slashAt);
    return span('text-ctp-green', host) + (slashAt === -1 ? '' : pathHtml(word.slice(slashAt)));
};

export const highlightCurl = (command: string): string => command.split(' ').map(wordHtml).join(' ');

// A bare path (`/city`) in the same colours.
export const highlightPath = (path: string): string => pathHtml(path);
