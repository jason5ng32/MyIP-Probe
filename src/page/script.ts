// The page's inline browser script, as plain JavaScript text: fills in the
// other IP version and local time, and runs the copy buttons and the
// text / json tabs. It reads its inputs from the `#probe-data` JSON block
// the renderer writes. The page reads fine without it.

export const PAGE_SCRIPT = `(() => {
  const data = JSON.parse(document.getElementById('probe-data').textContent);

  // The other IP version: the probe's own v4 / v6 host when configured,
  // else Cloudflare's public trace endpoint.
  const fillOther = () => {
    const other = data.other;
    if (!other) return;
    const line = document.querySelector('[data-ip-card="' + other.version + '"]');
    const value = line.querySelector('[data-ip-value]');
    const parse = other.kind === 'trace'
      ? (text) => ((text.split('\\n').find((row) => row.startsWith('ip=')) || '').slice(3).trim())
      : (text) => { try { return JSON.parse(text).ip || ''; } catch { return ''; } };
    fetch(other.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      .then((response) => (response.ok ? response.text() : ''))
      .then(parse)
      .catch(() => '')
      .then((ip) => {
        const matches = ip !== '' && (other.version === 6) === ip.includes(':');
        value.textContent = matches ? ip : 'not detected';
        value.classList.toggle('text-muted-foreground', !matches);
        line.dataset.state = matches ? 'found' : 'missing';
        data.ips[other.version] = matches ? ip : null;
      });
  };

  // Current time in the estimated time zone, refreshed every 30 seconds.
  document.querySelectorAll('[data-local-time]').forEach((element) => {
    try {
      const format = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: element.dataset.localTime });
      const tick = () => { element.textContent = '· ' + format.format(new Date()); };
      tick();
      setInterval(tick, 30000);
    } catch { /* unknown time zone: leave it blank */ }
  });

  // Copy buttons. data-copy says what: "ip:4" / "ip:6", "summary", "json", or
  // "text" with the string in data-copy-text. The label reads "copied" for a moment.
  // The original label is kept as HTML, so a coloured command comes back coloured.
  const originals = new WeakMap();
  const flash = (button, text) => {
    const label = button.querySelector('[data-copy-label]');
    if (!originals.has(label)) originals.set(label, label.innerHTML);
    label.textContent = text;
    clearTimeout(Number(button.dataset.timer));
    button.dataset.timer = String(setTimeout(() => { label.innerHTML = originals.get(label); }, 1500));
  };
  const summary = () => ['IPv4: ' + (data.ips[4] || 'not detected'), 'IPv6: ' + (data.ips[6] || 'not detected')]
    .concat(data.summary, 'Checked: ' + new Date().toISOString() + ' via ' + data.host)
    .join('\\n');
  const copyText = (button) => {
    const kind = button.dataset.copy;
    if (kind === 'summary') return summary();
    if (kind === 'json') return data.json;
    if (kind.startsWith('ip:')) return data.ips[kind.slice(3)] || '';
    return button.dataset.copyText || '';
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const text = copyText(button);
    if (!text) { flash(button, 'nothing to copy'); return; }
    navigator.clipboard.writeText(text).then(() => flash(button, 'copied'), () => flash(button, 'copy failed'));
  });

  // text / json tabs, mirrored in the URL hash.
  const show = (view) => {
    document.querySelectorAll('[data-view-panel]').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== view; });
    document.querySelectorAll('[data-view]').forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.dataset.state = active ? 'active' : 'inactive';
      tab.setAttribute('aria-selected', String(active));
    });
  };
  document.querySelectorAll('[data-view]').forEach((tab) => {
    tab.addEventListener('click', () => {
      show(tab.dataset.view);
      history.replaceState(null, '', tab.dataset.view === 'json' ? '#json' : location.pathname);
    });
  });
  show(location.hash === '#json' ? 'json' : 'text');

  fillOther();
})();`;
