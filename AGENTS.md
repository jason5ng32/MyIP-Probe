# AGENTS.md

Single source of truth for anyone — human or AI — contributing to MyIP-Probe.

## Overview

**MyIP-Probe** is a one-click "what's my IP" service for Cloudflare Workers:
a page for people, plain text for `curl`, JSON and single-field endpoints for
scripts and AI agents. It reports only the caller's own connection, read from
the request (`CF-Connecting-IP` + `request.cf`) — no lookup of other IPs, no
external services, no storage.

Two ways to run it:

- **Deployed as is** — anyone forks it and deploys it to their own account.
- **Wrapped** — another Worker imports `createProbe(options)` (through a git
  dependency) and adds what this repo never holds, such as per-hostname
  behaviour or request statistics. The export is a public contract: change
  it only on purpose, with its tests.

Licensed under AGPL-3.0-only (`LICENSE`).

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript, strict, erasable syntax only — no compile step |
| Runtime | Cloudflare Workers (ES modules), no framework; Wrangler bundles the `.ts` sources |
| Types | `wrangler types` → `worker-configuration.d.ts` (runtime + `Env`); checked by `tsc --noEmit` |
| Tooling | Wrangler 4 · TypeScript · pnpm (pinned via `packageManager`) · Node 26 for tests |
| Tests | Node built-in test runner (`node --test`), running `.ts` files directly through Node's type stripping |
| Page | Server-rendered HTML in the Catppuccin palette; Tailwind v4 compiled ahead of time into `src/page/styles.generated.ts` (committed) and inlined; shadcn recipes from MyIP, terminal style; a small inline script; no external fonts, CSS or CDN |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | `wrangler dev` — `request.cf` is mock data here |
| `pnpm build:css` | Compile `src/page/tailwind.css` into `src/page/styles.generated.ts` |
| `pnpm test` | Run all `tests/*.test.ts` specs |
| `pnpm typecheck` | `tsc --noEmit` over sources and tests |
| `pnpm types` | Regenerate `worker-configuration.d.ts` after a Wrangler or compatibility-date change |
| `pnpm check` | The pre-handoff self-check: `build:css` + `typecheck` + `test` |
| `pnpm deploy:dev` | Deploy a test Worker to your own account from `.env` (a human runs it, never an agent) |

**pnpm only**; never npm / yarn (they'd produce a competing lockfile).

## Layout

```
src/
├── index.ts      ← library entry for wrappers (createProbe, optionsFromEnv, FIELDS)
├── worker.ts     ← stand-alone Worker entry (wrangler `main`)
├── probe.ts      ← createProbe: methods, CORS, client IP → router
├── options.ts    ← ProbeOptions + the PROBE_* variables that map onto them
├── core/         ← platform-free: field registry, formats, routes, legacy contract,
│                   generated docs (docs/: /help, /llms.txt, /openapi.json)
└── page/         ← the page: renderer, inline script, shadcn recipes (ui.ts), logo, Tailwind input + generated CSS
scripts/          ← build:css and deploy:dev
tests/            ← node --test specs; fixtures/legacy pins `/` and `/geo`
```

Each file's header comment states its purpose — read those for specifics.

## Configuration

- `.env.example` is the template, committed; `.env` holds real values and is
  never committed. Every new variable lands in `.env.example` in the same
  change, with a comment saying what it does.
- `wrangler.toml` stays deployable by a stranger: `workers_dev` only, no
  routes, no account ids, no hostnames, `keep_vars = true` so dashboard
  variables survive redeploys. A deployment's own values live in the
  dashboard or in its fork; `pnpm deploy:dev` takes them from `.env`.
- Every variable is documented in the README's Configuration table
  (`tests/readme.test.ts` checks it).

## Conventions

### Language

- **TypeScript**, `.ts` files only, under `strict`. Write only syntax Node
  can strip without transforming (`erasableSyntaxOnly`): no `enum`, no
  `namespace`, no constructor parameter properties — use `as const` objects
  and union types instead.
- **Imports name the `.ts` file** (`import { x } from './fields.ts'`) — Node's
  test runner needs the real extension; type-only imports use `import type`.
- **No `any`.** Use `unknown` and narrow; a cast (`as`) carries a one-line
  comment saying why it holds. Runtime types come from the generated
  `worker-configuration.d.ts` (e.g. `request.cf`), never hand-written copies.
- **English** for code, comments, commit messages, docs and page copy.
  Local planning notes (`iterations/`, git-ignored) may be in any language.

### Functions

- **New functions use `const` arrow syntax** (`const fn = (a: string): number => …`),
  not `function` declarations. Object methods keep shorthand. Arrow consts
  aren't hoisted — declare before use.
- **Exported functions declare their return type**; local ones may infer it.

### Comments

- **Every file opens with a header comment** stating its purpose.
- **Large templates / functions carry short block comments** per meaningful
  region.
- **Comments describe the code as it is now** — no changelog narration
  (`previously…`, `…fixes that`); git history covers the past. A comment
  stays shorter than the code it explains.

### Output contract

- **One field registry drives everything**: each field's source in
  `request.cf`, its single-field path, its text form and its description.
  Endpoints, `/help`, `/openapi.json`, `/llms.txt` and the page all read it —
  a field never appears in one of them by hand.
- **Fields are only ever added.** A shipped field is never renamed, retyped
  or removed. JSON keys are lowercase snake_case, a missing value is `null`,
  numbers stay numbers (ASN, coordinates, RTT).
- **Plain-text output is one value, no decoration, newline-terminated.**
- **Legacy endpoints are frozen.** `/` and `/geo` answer byte-for-byte as the
  fixtures in `tests/fixtures/` say; new behaviour goes to new endpoints.
- **Format resolution**: each route lists the formats it answers in; an
  explicit `?format=` picks one (else 400 `bad_format`), otherwise the
  route's default applies. Client sniffing exists only on the legacy routes,
  for compatibility: `/` and `/geo` answer a curl User-Agent in text, and `/`
  answers an `Accept: text/html` navigation with the page.
- **Errors** are `{ error, code }` in JSON, or one line in text; a field with
  no value for this connection is a 404 `not_available` in either format.

### Page UI

- **Order: your IP, what this is, the details.** Right under the title bar
  is "Your IP" — the address and its copy button, nothing else. Then
  `DESCRIPTION` (one sentence, also the meta description) with the usage
  lines (this host's curl commands), short and factual. Then the fields.
- **Terminal style.** The page reads as a terminal session: `key value`
  lines per field group under `# group` headings, keys being the JSON field
  names, values exactly as the text endpoints return them. The audience is ops people, developers and agents; MyIP is
  the page for everyone else. No typing animation, blinking cursor or ASCII
  art; it follows the system's light / dark mode. The session sits straight
  on the page — one background, no card, border or shadow around it.
- **Catppuccin + fastfetch.** Colours are Catppuccin: Mocha in dark mode;
  in light mode Latte's accents on neutral surfaces and text (Latte's own
  are lavender-tinted). Like fastfetch's labels, each group's keys take one
  accent (`KEY` in `page.ts`: addresses mauve, location blue, network pink, connection
  sapphire); `# headings` are overlay2 italic; values the text colour;
  command paths the muted colour. The JSON tab uses Catppuccin's code roles
  (`json-highlight.ts`). Every curl example on the page goes through
  `curl-highlight.ts`: command mauve, flags peach, host green, path
  sapphire, query peach, placeholders overlay2 italic. On phones a field is
  one `key value` line and the command column is hidden.
- **shadcn recipes.** Buttons and the tabs are the class recipes in
  `src/page/ui.ts`, taken from MyIP's `frontend/components/ui`. Reuse them;
  add a recipe there before hand-rolling classes.
- **Tokens, not colours.** `src/page/tailwind.css` defines the Catppuccin
  palette and maps shadcn's token names onto it; use `bg-card`,
  `text-muted-foreground`, `text-ctp-blue`, … — never a raw colour.
- **Tailwind classes are written whole** in `.ts` strings (no
  concatenation), so the scanner finds them. After changing any class or
  `tailwind.css`, run `pnpm build:css` and commit `styles.generated.ts`;
  `pnpm check` regenerates it.
- **The page never links to an endpoint.** A line's path button copies its
  curl command; a click on the page never sends a request to the API.
- **Lines are `<dl>` entries** (`<dt>` key, `<dd>` value, `<dd>` command), so
  screen readers and agents reading the HTML get each field.
- **The logo is `src/page/logo.ts`**, MyIP Lite's mark, and the favicon is
  drawn from the same path (an inline SVG data URL, no extra request). A
  fork edits that file. No variable for it.
- **The head is complete**: description (`DESCRIPTION`), author (`AUTHOR`,
  edited in code like the logo), generator, Open Graph / Twitter card,
  `theme-color` per colour scheme, the favicon, and the links to the docs.

### Copy

- **State facts, never verdicts.** Show values and what they mean — never
  "leaked", "exposed", "unsafe" or anything meant to alarm.
- **Write for a global audience**: no examples or defaults aimed at one
  country or region.
- **Geography is an estimate** and is labelled as one; the IP shown belongs
  to whatever machine made the request — `llms.txt` says so for agents.

### Privacy

- The Worker stores nothing and logs nothing. Analytics (Google Analytics,
  through its measurement-id variable) load only when the deployer sets one;
  any "no logging" wording on the page appears only when none is set.

### Dependencies

- **No runtime dependencies** without the maintainers' agreement; dev
  dependencies (Wrangler, TypeScript, `@types/node`, Tailwind) stay on the
  latest stable release.
- **Never patch a dependency** (no `patch-package`, no `pnpm patch`): live
  with it, change version, or change library.

## Testing

- Every non-visual piece — format resolution, the field registry, renderers,
  CORS, config parsing — ships with a spec in `tests/` in the same change.
- Fixtures use documentation addresses (`192.0.2.0/24`, `198.51.100.0/24`,
  `203.0.113.0/24`, `2001:db8::/32`) and invented places — never a real IP,
  location or account.
- Rendering and real `request.cf` data are verified by a person on a test
  deployment; AI agents don't open a browser or deploy. A change that needs
  that check says so, with the exact URLs / `curl` commands to run.
- **`pnpm check` must be green before handing off.**

## Workflow

- **AI agents never commit without explicit approval** — the agent edits,
  a person reviews and tests, then says "commit". Agents never push.
- **One concern per commit**, message style `Feat(xxx):` / `Fix(xxx):` /
  `Refactor(xxx):` / `Style:` / `Docs:` / `Chore:`; AI adds itself as
  co-author.
- **AI agents never deploy** (`wrangler deploy`, `pnpm deploy:dev`) or
  change anything on a Cloudflare account; a person does.
- **On every commit, scan this file for staleness** — renamed files, flipped
  rules and dead examples get fixed in the same commit.

---

If `local-context.md` exists in the workspace root, read it too — it holds
machine-local notes and is never committed.
