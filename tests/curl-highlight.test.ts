// highlightCurl / highlightPath: colour spans around a curl command's parts,
// the text itself unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightCurl, highlightPath } from '../src/page/curl-highlight.ts';

const text = (html: string): string => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('each part of a command gets its colour', () => {
    const html = highlightCurl('curl -4 probe.example.com/ip?format=json');
    assert.equal(
        html,
        '<span class="text-ctp-mauve">curl</span> <span class="text-ctp-peach">-4</span> <span class="text-ctp-green">probe.example.com</span><span class="text-ctp-sapphire">/ip</span><span class="text-ctp-peach">?format=json</span>',
    );
});

test('placeholders are set apart and escaped', () => {
    const html = highlightCurl('curl probe.example.com/<key>');
    assert.ok(html.includes('<span class="italic text-ctp-overlay2">&lt;key&gt;</span>'));
    assert.ok(!html.includes('<key>'));
});

test('the text is unchanged for every shape of command', () => {
    for (const command of ['curl probe.example.com', 'curl -6 probe.example.com', 'curl probe.example.com/json', 'curl probe-4.example.com', 'curl -4']) {
        assert.equal(text(highlightCurl(command)), command);
    }
    assert.equal(highlightPath('/asn-org'), '<span class="text-ctp-sapphire">/asn-org</span>');
});
