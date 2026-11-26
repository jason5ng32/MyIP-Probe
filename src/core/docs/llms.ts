// `/llms.txt`: the service described for AI agents, in the llms.txt
// Markdown shape (title, summary, sections), generated from the field
// registry. States facts only — what the values are and what they are not.

import { FIELDS, fieldPath } from '../fields.ts';
import { ERROR_CODES } from '../respond.ts';
import type { DocsContext } from './context.ts';

export const renderLlmsTxt = (context: DocsContext): string => {
    const base = `https://${context.host}`;
    const { v4, v6 } = context.hosts;

    const versionHosts = [
        v4 ? `- \`https://${v4}/\` is reachable over IPv4 only, so it always reports the caller's IPv4 address.` : null,
        v6 ? `- \`https://${v6}/\` is reachable over IPv6 only, so it always reports the caller's IPv6 address; a failed connection usually means the caller has no working IPv6.` : null,
    ].filter((line) => line !== null);

    const fields = FIELDS.map((field) => `- \`${field.key}\` (${field.type} or null, \`${fieldPath(field)}\`): ${field.description}`);

    return [
        '# MyIP Probe',
        '',
        "> Returns the public IP address and connection details of whatever makes the request, as Cloudflare's edge sees it: plain text for curl, JSON for programs.",
        '',
        "The address reported is the public IP of the machine that sends the request. Called from a server, sandbox or CI runner, it is that machine's address, not the address of the person you are working for; ask them to open the page or run the command themselves when you need theirs.",
        '',
        "Location, network and time zone come from Cloudflare's IP data and are estimates. Report them as such; they do not identify a person or a precise place.",
        '',
        '## Endpoints',
        '',
        `- \`GET ${base}/\`: the caller's IP. curl gets plain text; other clients get \`{"ip": "..."}\`; browsers get a page.`,
        `- \`GET ${base}/json\`: every field below as one JSON object; a missing value is \`null\`.`,
        `- \`GET ${base}/<path>\`: one field as plain text, or \`{"<key>": value}\` with \`?format=json\`. A field this connection has no value for answers 404 with code \`not_available\`.`,
        `- \`GET ${base}/help\`: a plain-text cheat sheet.`,
        `- \`GET ${base}/openapi.json\`: OpenAPI 3.1 description.`,
        `- \`GET ${base}/health\`: \`{"status": "ok"}\`.`,
        ...(versionHosts.length > 0 ? ['', '## IP versions', '', ...versionHosts] : []),
        '',
        '## Fields',
        '',
        ...fields,
        '',
        '## Errors',
        '',
        `Errors in JSON are \`{"error": "...", "code": "..."}\`, or one line of text for plain-text requests. Codes: ${ERROR_CODES.map((code) => `\`${code}\``).join(', ')}.`,
        '',
    ].join('\n');
};
