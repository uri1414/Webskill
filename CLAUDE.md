# Baseline Studio — project notes for Claude

Static marketing site for **The Baseline Studio** (a web-design business), hosted on **Netlify** and deployed from the `claude/web-design-business-7xammo` branch. No build step (`publish = "."`).

## ⚠️ Deployment gotchas (read before touching redirects)

**Do NOT add a 301 redirect from `/sites/baseline-studio/index.html` → `/`.**
It creates an infinite redirect loop and takes the whole site down
("Redirecting to Baseline…" forever). Why:
- The root `index.html` is a stub with `<meta http-equiv="refresh" … url=/sites/baseline-studio/index.html>`.
- So a 301 on that path bounces `/` → stub → `/sites/…` → 301 → `/` → … forever.

**Current working setup (`netlify.toml`):** a single `[[redirects]]` rule serves
the studio page at the root with `status = 200` **and `force = true`** (force is
required — without it the physical `/index.html` stub shadows the rewrite).
Duplicate content on the raw file path is handled by the `<link rel="canonical">`
on the studio page, NOT by a redirect.

**Netlify config cannot be tested from the agent sandbox** (no outbound access to
the live site). Reason through redirect/rewrite interactions carefully before
merging, and prefer the smallest change. If a config change is risky, say so.

## Site structure
- `sites/baseline-studio/index.html` — the real homepage (English), served at `/`.
- `es/index.html` — prerendered Spanish page, served at `/es/`. Language switch is
  **URL-based** (`/` ↔ `/es/`), not a client-side JS toggle. If you change EN copy,
  update the ES page too (translations come from the site's original `I18N` dictionary).
- `index.html` (root) — legacy redirect stub; bypassed by the forced root rewrite.
- `robots.txt`, `sitemap.xml` (both URLs + `hreflang` alternates), `llms.txt`, `404.html`.
- `sites/baseline-studio/assets/` — WebP image + self-hosted fonts (`fonts/`).

## SEO status (implemented)
JSON-LD (`WebSite` + `ProfessionalService` + `FAQPage`, localized on `/es/`),
canonical, `hreflang` (en/es/x-default), `<main>` + skip link, WebP via `<picture>`,
self-hosted Bricolage Grotesque + Figtree, custom 404, `llms.txt`.
Still open: local SEO for **Salem, OR + surrounding mid-Willamette Valley**
(schema `areaServed` + visible "Based in Salem, Oregon" line) and social `sameAs`
(footer links are `#` placeholders — need real profile URLs).

## Working practices
- **Conserve Netlify credits:** batch changes into a single PR/deploy rather than
  one PR per fix. Each push to the deploy branch triggers a build.
- Run the impeccable design detector on any HTML changes:
  `node .claude/skills/impeccable/scripts/detect.mjs <file>` (aim for exit 0).
- Keep the EN and ES pages in sync.
