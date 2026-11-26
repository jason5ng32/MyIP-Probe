# MyIP-Probe

Your public IP address and connection details, as Cloudflare's edge sees the request — a page for people, plain text for `curl`, JSON for scripts and AI agents. One Cloudflare Worker, no servers, no API keys, no database.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jason5ng32/MyIP-Probe)

```console
$ curl probe.example.com
203.0.113.42

$ curl probe.example.com/city
Amsterdam

$ curl probe.example.com/json
{
  "ip": "203.0.113.42",
  "ip_version": 4,
  "city": "Amsterdam",
  "country_code": "NL",
  "asn": 64500,
  "colo": "AMS",
  ...
}
```

- **One Worker, no keys.** Everything comes from the request itself (`CF-Connecting-IP` and `request.cf`): location, network, the Cloudflare data center that answered, HTTP and TLS versions, TCP round-trip time.
- **For terminals and agents.** Every field has its own plain-text endpoint, `/json` returns them all, and `/help`, `/llms.txt` and `/openapi.json` describe the service to people, AI agents and tools.
- **IPv4 and IPv6 side by side.** The page shows both addresses; give it an IPv4-only and an IPv6-only hostname and `curl` can ask for either.
- **Private by default.** The Worker stores and logs nothing; analytics load only if you add a Google Analytics id.

It reports only the caller's own connection — it does not look up other IP addresses.

## Endpoints

| Endpoint | Answers |
|---|---|
| `GET /` | The caller's IP: plain text for curl, `{"ip": "..."}` for other clients, the page for browsers |
| `GET /json` | Every field as one JSON object; a missing value is `null` |
| `GET /<field>` | One field as plain text, e.g. `/city`, `/asn-org`; `?format=json` gives `{"<key>": value}` |
| `GET /help` | A plain-text cheat sheet |
| `GET /llms.txt` | The service described for AI agents |
| `GET /openapi.json` | OpenAPI 3.1 description |
| `GET /health` | `{"status": "ok"}` |
| `GET /geo` | A legacy summary, kept unchanged for existing scripts |

A field's path is its JSON key with dashes. A field this connection has no value for answers 404 with the code `not_available`; errors in JSON are `{"error": "...", "code": "..."}`.

### Fields

| Group | Keys |
|---|---|
| Address | `ip`, `ip_version` |
| Location (estimated) | `city`, `region`, `region_code`, `postal_code`, `country`, `country_code`, `continent_code`, `is_eu`, `latitude`, `longitude`, `timezone` |
| Network | `asn`, `asn_org` |
| Connection | `colo`, `http_protocol`, `tls_version`, `tls_cipher`, `tcp_rtt_ms` |

Each field's type and description are in `/openapi.json` and `/llms.txt` of any deployment. Location and network come from Cloudflare's IP data and are estimates.

## Deploy

**One click:** the button above copies this repository to your GitHub account and deploys it to your Cloudflare account. There is nothing to fill in: it runs at `myip-probe.<your-subdomain>.workers.dev` straight away, and every setting below is optional.

**After deploying**, in the Cloudflare dashboard:

1. Open `https://myip-probe.<your-subdomain>.workers.dev` to check it works.
2. Give it your own hostname (see [Your own hostname](#your-own-hostname)) — the deploy flow cannot add one for you.
3. Optionally set variables (see [Configuration](#configuration)), e.g. `PROBE_SITE_NAME` for the page title.
4. Optionally add IPv4-only and IPv6-only hostnames (see [below](#ipv4-only-and-ipv6-only-hostnames-optional)).
5. Optionally add a rate limit (see [Protect it](#protect-it)).

**From a clone:**

```bash
pnpm install
pnpm exec wrangler deploy
```

No build step is needed: Wrangler bundles the TypeScript sources, and the page's CSS is committed.

### Your own hostname

The domain must be on Cloudflare (its nameservers pointing at Cloudflare; the free plan is enough). In the Cloudflare dashboard, open the Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain**, and enter e.g. `probe.example.com`. Cloudflare creates the DNS record and certificate.

The `workers.dev` address keeps working alongside it. To serve only your hostname, turn `workers.dev` off under **Domains & Routes** — and set `workers_dev = false` in your copy's `wrangler.toml`, or the next deploy from your repository turns it back on. Zone rules such as a rate limit never apply to `workers.dev`, so a public probe is better without it.

### IPv4-only and IPv6-only hostnames (optional)

A normal Cloudflare hostname answers over both IP versions, so `curl` gets whichever the client prefers. To always get one version, add two more hostnames that reach Cloudflare over only one of them:

1. Find Cloudflare's addresses for your zone: resolve any proxied hostname in it, e.g. `dig +short A probe.example.com` and `dig +short AAAA probe.example.com`.
2. Add two **DNS-only** (grey cloud) records: `probe-4` as an `A` record pointing at one of the IPv4 addresses, `probe-6` as an `AAAA` record pointing at one of the IPv6 addresses.
3. Add a Worker **route** for each: `probe-4.example.com/*` and `probe-6.example.com/*` (Settings → Domains & Routes → Add → Route).
4. Set the variables `PROBE_HOST`, `PROBE_HOST_V4` and `PROBE_HOST_V6` (below), so the page can query both and the docs mention them.

Keep these two hostnames directly under the zone (`probe-4.example.com`, not `probe-4.dev.example.com`): their HTTPS uses the zone's `*.example.com` certificate, which covers one level only.

## Protect it

Each request runs the Worker once. On the Workers free plan that is up to 100,000 requests a day; past that, requests fail until the next day, at no cost. On a paid plan the excess is billed, so a public probe deserves a limit:

- **Rate limit.** In the zone, open **Security** → **Security rules** → **Rate limiting rules** (older dashboards: **Security** → **WAF**) and create one rule — the free plan includes one. Match on the hostname alone, e.g. `http.host eq "probe.example.com"`, with no condition on the request method. For example: more than 30 requests in 10 seconds from one IP → **Block** for 10 seconds. People and scripts that call it now and then never get near that; a loop does.
- **No browser challenges on this hostname.** Its main users are `curl`, scripts and agents, which cannot pass a challenge. Keep **Bot Fight Mode**, **I'm Under Attack** mode and any rule with a *Managed Challenge* away from it; if the zone uses them, exclude this hostname, or `curl` gets a challenge page instead of an IP.
- **Turn `workers.dev` off** (see [Your own hostname](#your-own-hostname)) so the rate limit cannot be bypassed.

The Worker itself keeps no logs and stores nothing; by default only its own hostnames may call it from another site's page (see `PROBE_ALLOWED_ORIGINS` below).

## Configuration

All variables are optional. Set them in the Cloudflare dashboard (Worker → **Settings** → **Variables and Secrets** → **Add**, type *Text*), or as `[vars]` in your fork's `wrangler.toml`. `keep_vars = true` in `wrangler.toml` keeps dashboard variables across redeploys. [`.env.dev.example`](.env.dev.example) lists them all with comments.

| Variable | Default | Example | Effect |
|---|---|---|---|
| `PROBE_HOST` | — | `probe.example.com` | The hostname serving the page, so the IPv4 / IPv6 hosts accept its lookups. Needed only with `PROBE_HOST_V4` / `PROBE_HOST_V6` |
| `PROBE_HOST_V4` | — | `probe-4.example.com` | An IPv4-only hostname (see above) |
| `PROBE_HOST_V6` | — | `probe-6.example.com` | An IPv6-only hostname (see above) |
| `PROBE_SITE_NAME` | `MyIP Probe` | `Acme IP` | Name in the page header and title |
| `PROBE_PAGE` | `true` | `false` | `false` serves no page: `/` answers as an API only |
| `PROBE_GA_ID` | — | `G-ABC123XYZ` | A Google Analytics measurement id; without it the page loads no analytics |
| `PROBE_PRIVACY_NOTE` | on without `PROBE_GA_ID` | `false` | `false` hides the page's "keeps no logs and runs no analytics" line — do so if you record requests in any way |
| `PROBE_FULL_REPORT_URL` | `https://ipcheck.ing` | `off` | The footer's "full report" link: an https URL, or `off` to hide it |
| `PROBE_ALLOWED_ORIGINS` | — | `https://app.example.com,http://localhost:5173` | Origins that may read the API from a browser, comma-separated, or `*` for any. The probe's own hostnames always may |
| `PROBE_ALLOWED_ROOT_DOMAINS` | — | `example.com` | Domains whose https origins (and subdomains) may read the API, comma-separated |
| `PROBE_LEGACY_NOTE` | a link to ipcheck.ing | `Self-hosted probe` | The `note` line of the legacy `/geo` answer |

A variable with an invalid value makes every request answer 500 with the list of problems, so a typo shows up on the first request.

Calls from `curl`, scripts and servers are never limited by origin. Only another website's page, calling the probe from a visitor's browser, needs `PROBE_ALLOWED_ORIGINS` or `PROBE_ALLOWED_ROOT_DOMAINS` to read the answer.

The logo and author live in `src/page/logo.ts` and `src/page/page.ts`; edit them in your fork.

## Use it as a library

Another Worker can import the probe and add what it needs around it — per-hostname behaviour, request logging, analytics:

```bash
pnpm add github:jason5ng32/MyIP-Probe#v1.0.0
```

```ts
import { createProbe } from 'myip-probe';

const page = createProbe({ siteName: 'Example', hosts: { main: 'probe.example.com', v4: 'probe-4.example.com', v6: 'probe-6.example.com' } });
const api = createProbe({ page: false });

export default {
    fetch: (request: Request, env: unknown, ctx: ExecutionContext) => {
        ctx.waitUntil(recordRequest(request)); // your own logging
        const host = new URL(request.url).hostname;
        return (host === 'probe.example.com' ? page : api).fetch(request);
    },
};
```

`createProbe(options)` takes the same settings as the variables above (`page`, `siteName`, `gaMeasurementId`, `fullReportUrl`, `privacyNote`, `legacyNote`, `hosts`, `cors`); `optionsFromEnv(env)` reads them from variables. The package exports TypeScript sources, which your Wrangler bundles.

## Development

```bash
pnpm install
pnpm dev          # wrangler dev; request.cf holds mock data locally
pnpm check        # build the CSS, type-check, run the tests
```

Requires Node 26 and pnpm. Real `request.cf` data only exists on Cloudflare, so a test deployment helps: copy `.env.dev.example` to `.env`, fill it in and run `pnpm deploy:dev`. Contributor conventions are in [AGENTS.md](AGENTS.md).

## Credits

- Colours: [Catppuccin](https://catppuccin.com) (MIT).
- Styles: [Tailwind CSS](https://tailwindcss.com) with [shadcn](https://ui.shadcn.com)-style component recipes.
- From the makers of [MyIP / IPCheck.ing](https://github.com/jason5ng32/MyIP).

## License

[AGPL-3.0](LICENSE)
