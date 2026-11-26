// highlightJson: colour spans around JSON tokens, the text itself unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightJson } from '../src/page/json-highlight.ts';
import { readInfo } from '../src/core/fields.ts';
import { connectionNamed } from './helpers/fixtures.ts';

const unescape = (html: string): string =>
    html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('stripping the spans gives back the exact pretty-printed JSON', () => {
    for (const name of ['full_v4', 'full_v6', 'sparse', 'no_cf']) {
        const info = readInfo(connectionNamed(name));
        assert.equal(unescape(highlightJson(info)), JSON.stringify(info, null, 2), name);
    }
});

test('each token kind gets its colour', () => {
    const html = highlightJson({ city: 'Exampleton', asn: 64500, lat: -1.5e3, is_eu: true, region: null });
    assert.ok(html.includes('<span class="text-ctp-blue">&quot;city&quot;</span>:'));
    assert.ok(html.includes('<span class="text-ctp-green">&quot;Exampleton&quot;</span>'));
    assert.ok(html.includes('<span class="text-ctp-peach">64500</span>'));
    assert.ok(html.includes('<span class="text-ctp-peach">-1500</span>'));
    assert.ok(html.includes('<span class="text-ctp-mauve">true</span>'));
    assert.ok(html.includes('<span class="text-ctp-mauve">null</span>'));
});

test('markup and quotes inside strings stay escaped and inside one span', () => {
    const html = highlightJson({ asn_org: 'A "B" <C> & D: 1 true' });
    assert.ok(html.includes('<span class="text-ctp-green">&quot;A \\&quot;B\\&quot; &lt;C&gt; &amp; D: 1 true&quot;</span>'));
    assert.ok(!html.includes('<C>'));
    assert.equal(html.match(/text-ctp-peach|text-ctp-mauve/g), null, 'numbers and literals inside a string are not tokens');
});
