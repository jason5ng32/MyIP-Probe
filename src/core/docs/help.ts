// `/help`: a plain-text cheat sheet for the terminal, under 40 lines,
// generated from the field registry.

import { FIELDS, fieldPath } from '../fields.ts';
import { versionCommand, type DocsContext } from './context.ts';

const WIDTH = 72;

// Words joined with spaces, wrapped to WIDTH, each line indented.
const wrap = (words: readonly string[], indent: string): string[] => {
    const lines: string[] = [];
    let line = indent;
    for (const word of words) {
        if (line.length > indent.length && line.length + 1 + word.length > WIDTH) {
            lines.push(line);
            line = indent;
        }
        line += (line.length > indent.length ? ' ' : '') + word;
    }
    if (line.length > indent.length) lines.push(line);
    return lines;
};

// Command and note, the notes aligned in one column.
const table = (rows: readonly [string, string][]): string[] => {
    const width = Math.max(...rows.map(([command]) => command.length));
    return rows.map(([command, note]) => `  ${command.padEnd(width)}   ${note}`);
};

export const renderHelp = (context: DocsContext): string => {
    const { host } = context;
    const lines = [
        "Your public IP address and connection details, as Cloudflare's edge",
        'sees this request. The IP is that of the machine making the request.',
        '',
        ...table([
            [`curl ${host}`, 'your IP, as plain text'],
            [`curl ${host}/json`, 'every field as JSON (missing values are null)'],
            [`curl ${host}/<field>`, 'one field as plain text'],
            [`curl ${host}/<field>?format=json`, 'one field as {"<key>": value}'],
            [versionCommand(4, context), 'ask over IPv4'],
            [versionCommand(6, context), 'ask over IPv6'],
        ]),
        '',
        'Fields (the path is the JSON key with dashes, e.g. /asn-org):',
        ...wrap(FIELDS.map((field) => fieldPath(field).slice(1)), '  '),
        '',
        'A field this connection has no value for answers 404 (not_available).',
        'Errors in JSON are {"error": "...", "code": "..."}.',
        'Location and network are estimates.',
        '',
        ...table([
            [`curl ${host}/llms.txt`, 'the same, written for AI agents'],
            [`curl ${host}/openapi.json`, 'OpenAPI 3.1 description'],
            [`curl ${host}/health`, 'liveness check'],
        ]),
    ];
    return lines.join('\n') + '\n';
};
