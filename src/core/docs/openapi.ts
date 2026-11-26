// `/openapi.json`: an OpenAPI 3.1 description of every endpoint, generated
// from the field registry so it cannot drift from what the routes answer.

import { FIELDS, fieldPath, type FieldSpec } from '../fields.ts';
import { ERROR_CODES } from '../respond.ts';
import type { DocsContext } from './context.ts';

const ref = (name: string): { $ref: string } => ({ $ref: `#/components/schemas/${name}` });

const formatParameter = (formats: readonly string[], fallback: string): object => ({
    name: 'format',
    in: 'query',
    required: false,
    description: `Output format; without it the endpoint answers in ${fallback}.`,
    schema: { type: 'string', enum: formats },
});

const errorResponse = (description: string): object => ({
    description,
    content: { 'application/json': { schema: ref('Error') }, 'text/plain': { schema: { type: 'string' } } },
});

const fieldSchema = (field: FieldSpec): object => ({ type: [field.type, 'null'], description: field.description });

const fieldOperation = (field: FieldSpec): object => ({
    get: {
        operationId: `get_${field.key}`,
        summary: field.label,
        description: `${field.description} Plain text by default.`,
        tags: [field.group],
        parameters: [formatParameter(['text', 'json'], 'plain text')],
        responses: {
            200: {
                description: `The ${field.key} value.`,
                content: {
                    'text/plain': { schema: { type: 'string' } },
                    'application/json': {
                        schema: { type: 'object', required: [field.key], properties: { [field.key]: { type: field.type } } },
                    },
                },
            },
            400: errorResponse('Unsupported format (bad_format).'),
            404: errorResponse('This connection has no value for the field (not_available).'),
        },
    },
});

const textOperation = (operationId: string, summary: string, contentType: string): object => ({
    get: { operationId, summary, responses: { 200: { description: summary, content: { [contentType]: { schema: { type: 'string' } } } } } },
});

export const renderOpenApi = (context: DocsContext): object => ({
    openapi: '3.1.0',
    info: {
        title: 'MyIP Probe',
        version: '1',
        summary: "The caller's public IP address and connection details, as Cloudflare's edge sees the request.",
        description:
            'Every value describes the machine making the request. Location, network and time zone are estimates. Methods other than GET, HEAD and OPTIONS answer 405 (method_not_allowed).',
    },
    servers: [{ url: `https://${context.host}` }],
    paths: {
        '/': {
            get: {
                operationId: 'get_caller_ip',
                summary: "The caller's IP",
                description: 'curl gets plain text, other clients JSON, browser navigations an HTML page.',
                parameters: [formatParameter(['text', 'json', 'html'], 'a format chosen by the client')],
                responses: {
                    200: {
                        description: "The caller's IP.",
                        content: {
                            'text/plain': { schema: { type: 'string' } },
                            'application/json': { schema: { type: 'object', required: ['ip'], properties: { ip: { type: ['string', 'null'] } } } },
                            'text/html': { schema: { type: 'string' } },
                        },
                    },
                    400: errorResponse('Unsupported format (bad_format).'),
                },
            },
        },
        '/json': {
            get: {
                operationId: 'get_all',
                summary: 'Every field',
                responses: {
                    200: { description: 'Every field; a missing value is null.', content: { 'application/json': { schema: ref('ProbeInfo') } } },
                    400: errorResponse('Unsupported format (bad_format).'),
                },
            },
        },
        ...Object.fromEntries(FIELDS.map((field) => [fieldPath(field), fieldOperation(field)])),
        '/geo': {
            get: {
                operationId: 'get_legacy_geo',
                summary: 'Legacy summary',
                description: 'Kept unchanged for existing scripts; use /json instead.',
                deprecated: true,
                parameters: [formatParameter(['text', 'json'], 'text for curl, else JSON')],
                responses: { 200: { description: 'Legacy summary.', content: { 'text/plain': { schema: { type: 'string' } }, 'application/json': { schema: { type: 'object' } } } } },
            },
        },
        '/help': textOperation('get_help', 'Plain-text cheat sheet', 'text/plain'),
        '/llms.txt': textOperation('get_llms_txt', 'Description for AI agents', 'text/markdown'),
        '/openapi.json': {
            get: { operationId: 'get_openapi', summary: 'This document', responses: { 200: { description: 'This document.', content: { 'application/json': { schema: { type: 'object' } } } } } },
        },
        '/health': {
            get: {
                operationId: 'get_health',
                summary: 'Liveness check',
                parameters: [formatParameter(['json', 'text'], 'JSON')],
                responses: {
                    200: {
                        description: 'The service is up.',
                        content: {
                            'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { const: 'ok' } } } },
                            'text/plain': { schema: { type: 'string' } },
                        },
                    },
                },
            },
        },
    },
    components: {
        schemas: {
            ProbeInfo: {
                type: 'object',
                required: FIELDS.map((field) => field.key),
                properties: Object.fromEntries(FIELDS.map((field) => [field.key, fieldSchema(field)])),
            },
            Error: {
                type: 'object',
                required: ['error', 'code'],
                properties: { error: { type: 'string' }, code: { type: 'string', enum: [...ERROR_CODES] } },
            },
        },
    },
});
