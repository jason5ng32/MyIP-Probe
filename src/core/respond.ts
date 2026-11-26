// Response builders shared by every route: plain text, JSON and the uniform
// error body. Every response is per caller, so none may be cached.

import type { Format } from './format.ts';

export const ERROR_CODES = ['not_found', 'bad_format', 'not_available', 'method_not_allowed', 'bad_config'] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export const TEXT_TYPE = 'text/plain; charset=utf-8';
export const JSON_TYPE = 'application/json; charset=utf-8';
export const HTML_TYPE = 'text/html; charset=utf-8';
export const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';

export const respond = (body: string, contentType: string, status = 200): Response =>
    new Response(body, { status, headers: { 'Content-Type': contentType, ...NO_STORE } });

// Plain text is one value per line and always ends with a newline.
export const textResponse = (body: string, status = 200): Response =>
    respond(body.endsWith('\n') ? body : body + '\n', TEXT_TYPE, status);

export const jsonResponse = (value: unknown, status = 200): Response =>
    respond(JSON.stringify(value, null, 2) + '\n', JSON_TYPE, status);

// Errors follow the format the caller asked for: one line of text, or
// `{ error, code }`.
export const errorResponse = (status: number, code: ErrorCode, message: string, format: Format): Response =>
    format === 'text' ? textResponse(message, status) : jsonResponse({ error: message, code }, status);
