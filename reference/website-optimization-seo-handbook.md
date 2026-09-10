# Website Optimization & SEO Handbook

A complete, reusable reference for building fast, well-ranked websites —
especially **local service businesses** (cleaning, junk removal, trades, tax,
tile, etc.). Written from real work on albanyprocleaning.com and applicable to
every site you build.

Use it three ways: **read it** to understand *why* each thing matters, **copy
the snippets** when implementing, and **run the checklists** at the end before
every launch.

---

## Table of contents

1. [Philosophy — the three pillars](#philosophy)
2. [Part A — Performance & Core Web Vitals](#part-a)
3. [Part B — SEO](#part-b)
4. [Part C — Local SEO](#part-c)
5. [Part D — AI / generative search (GEO)](#part-d)
6. [Part E — Measurement & tools](#part-e)
7. [Part F — The workflow (build → launch → monitor)](#part-f)
8. [Part G — Checklists](#part-g)
9. [Appendix — thresholds, pitfalls, and honesty rules](#appendix)

---

<a name="philosophy"></a>
## 1. Philosophy — the three pillars

Every site we ship stands on three legs. A site can be beautiful and still fail
if any one is missing:

1. **Fast** — it loads quickly on a mid-range phone on a weak connection.
2. **Findable** — search engines (and AI answer engines) can crawl, understand,
   and confidently rank it.
3. **Converting** — a visitor can become a lead without friction (clear CTA,
   visible phone, a form that actually works).

Speed and SEO serve conversion. A #1 ranking that loads in 6 seconds still loses
the customer. Optimize all three together.

**One honesty rule that overrides everything:** never fake trust signals. No
invented reviews, no `aggregateRating` schema without real ratings, no dozens of
near-identical "doorway" city pages. It violates Google's guidelines and FTC
rules, and it eventually tanks the site. Earn the signals instead.

---

<a name="part-a"></a>
## 2. Part A — Performance & Core Web Vitals

### 2.1 How performance is actually scored

Google's **PageSpeed Insights** shows two kinds of data:

- **Lab data** (Lighthouse): a single simulated load — throttled CPU and
  network. This is what you get on a brand-new site. It's worst-case and
  deterministic-ish, good for finding problems.
- **Field data** (CrUX): real Chrome users over the last 28 days. Shows "No
  Data" until the site has enough traffic. This is what Google actually ranks on.

**Core Web Vitals** (the metrics that matter for ranking):

| Metric | Measures | "Good" (field) |
| --- | --- | --- |
| **LCP** (Largest Contentful Paint) | when the biggest element paints | ≤ 2.5 s |
| **INP** (Interaction to Next Paint) | responsiveness to taps/clicks | ≤ 200 ms |
| **CLS** (Cumulative Layout Shift) | visual stability (no jumping) | ≤ 0.1 |

Lab reports also show **FCP** (first paint), **TBT** (Total Blocking Time — the
lab proxy for INP), and **Speed Index**.

**Mobile vs desktop are graded on different curves.** Desktop assumes fast
hardware, so thresholds are stricter — e.g. LCP "good" is ≤ 1.2 s on desktop but
≤ 2.5 s on mobile. A desktop score *lower* than mobile is common and usually
means (a) the stricter curve and/or (b) the desktop layout runs more JavaScript
or loads a bigger hero. **TBT is 30% of the Lighthouse score — it's the metric
most worth fixing.**

### 2.2 The core idea

A score is dominated by **how little the browser must do before first paint**.
Every optimization does one of three things — if it doesn't, skip it:

1. **Send fewer bytes** (images above all).
2. **Shorten the critical path** (the request chain blocking first paint).
3. **Keep the main thread free** during load (defer non-essential JS).

### 2.3 Images (usually the biggest win)

Images are typically 60–80% of page weight.

**Modern formats — AVIF → WebP → fallback:**

```html
<picture>
  <source type="image/avif" srcset="/img/hero-640.avif 640w, /img/hero-960.avif 960w, /img/hero-1280.avif 1280w" sizes="100vw">
  <source type="image/webp" srcset="/img/hero-640.webp 640w, /img/hero-960.webp 960w, /img/hero-1280.webp 1280w" sizes="100vw">
  <img src="/img/hero.jpg" alt="…" width="1931" height="814" decoding="async">
</picture>
```

AVIF is ~30–50% smaller than WebP. Generate with `avifenc`, ImageMagick, or
Python Pillow (v11.3+):

```python
from PIL import Image
Image.open("hero.jpg").convert("RGB").save("hero-960.avif", format="AVIF", quality=58, speed=4)
```

**Rules:**
- Give mobile a **smaller source** (`640w`) so phones don't fetch the desktop
  image. Set `sizes` to the real layout.
- **LCP/hero image:** `fetchpriority="high"`, no `loading="lazy"`, and preload it:
  ```html
  <link rel="preload" as="image" type="image/avif" href="/img/hero-640.avif"
        imagesrcset="/img/hero-640.avif 640w, /img/hero-960.avif 960w" imagesizes="100vw" fetchpriority="high">
  ```
- **Everything below the fold:** `loading="lazy" decoding="async"`.
- **Always set `width` + `height`** (prevents layout shift → protects CLS). Use
  `object-fit: cover` to crop without distortion.
- **No hidden-but-downloaded images:** a `display:none` image on mobile still
  downloads. Don't render it, or serve a tiny source.

### 2.4 CSS — don't block the first paint

An external `<link rel="stylesheet">` is render-blocking. On mobile that's a
full round-trip of delay before anything shows.

- **Small sites:** minify and **inline the whole stylesheet** in `<style>`, drop
  the external link. (Albany's CSS is ~22 KB min / ~5 KB gzipped — inlining
  removed a render-blocking request with zero visual change.)
- **Large sites:** inline only critical above-the-fold CSS; load the rest async.
- Always **minify** and remove unused rules and font weights.

### 2.5 Fonts

Cross-origin Google Fonts means new connections (DNS + TCP + TLS) to
`fonts.googleapis.com` and `fonts.gstatic.com` before styled text renders — pure
mobile latency.

- **Good — non-blocking load:**
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=…&display=swap">
  <link rel="stylesheet" media="print" onload="this.media='all'" href="https://fonts.googleapis.com/css2?family=…&display=swap">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=…&display=swap"></noscript>
  ```
- **Better — self-host** the woff2 files from your own domain with a long cache;
  removes the cross-origin hops entirely. Highest-leverage remaining FCP fix.
- Always `display=swap`; request **only the weights you use**.

### 2.6 JavaScript & the main thread (TBT / INP)

- **Defer analytics.** gtag.js (~66 KB) blocks the main thread for data you don't
  need in the first 3 seconds. Queue the call, load the script on first
  interaction or idle:
  ```html
  <script>
    window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date()); gtag('config','G-XXXX');
    (function(){var done=false;function load(){if(done)return;done=true;
      var s=document.createElement('script');s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id=G-XXXX';document.head.appendChild(s);}
      ['scroll','mousemove','touchstart','click','keydown'].forEach(function(e){
        window.addEventListener(e,load,{once:true,passive:true});});
      setTimeout(load,3000);})();
  </script>
  ```
  This is what drove Albany's TBT to **0 ms**.
- Load first-party scripts with `defer`.
- **Third-party embeds** (chat widgets, booking, maps, carousels) are the usual
  cause of high TBT — especially on desktop where more of them mount. Lazy-load
  or defer them; load a map only when it scrolls into view.
- **Forced reflow** (reading layout right after writing DOM): batch reads in
  `requestAnimationFrame` and coalesce resize/scroll bursts with a ticking flag.

### 2.7 Delivery

- **Cache static assets immutable** (Netlify example):
  ```toml
  [[headers]]
    for = "/assets/*"
    [headers.values]
      Cache-Control = "public, max-age=31536000, immutable"
  ```
- Ensure the host serves **gzip/brotli** (Netlify/Cloudflare do automatically).
- Right-size favicons — a stray 183 KB favicon PNG is free weight to delete.

### 2.8 Diagnosing a specific low metric

- **High TBT / low INP** → open Lighthouse *"Minimize main-thread work"*,
  *"Reduce JavaScript execution time"*, *"Reduce unused JavaScript"*, and *View
  Treemap*. Defer or trim whatever tops the list.
- **High LCP** → is the LCP element preloaded? Is it AVIF/WebP and correctly
  sized? Is it waiting behind a font or script?
- **High CLS** → find the element without dimensions or the late-injected banner.
- Always **run 3+ times and compare the range** — lab scores (TBT especially)
  are noisy. Re-check desktop after a mobile pass.

---

<a name="part-b"></a>
## 3. Part B — SEO

### 3.1 On-page (every page)

- **One `<title>`**, unique per page, ~50–60 characters (it truncates in results
  past ~60). Lead with the keyword, end with the brand:
  `House & Commercial Cleaning in Albany | Albany Pro Cleaning`.
- **One meta description**, unique, ~140–160 chars, written to earn the click
  (not for ranking — it's the ad copy under the title).
- **Exactly one `<h1>`** matching the page's intent, then a logical `H2`/`H3`
  hierarchy. Never use headings just for visual size.
- **Self-referencing canonical:** `<link rel="canonical" href="https://…/page/">`.
- **Open Graph + Twitter tags** so shared links show a title, description, and a
  1200×630 preview image.
- **Clean URLs:** lowercase, hyphenated, descriptive, shallow
  (`/services/deep-cleaning/`), no query junk, trailing-slash consistent.

### 3.2 Technical SEO

- **`robots.txt`** — allow crawling, point to the sitemap, and explicitly allow
  AI crawlers (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended)
  so the business can be cited in AI answers.
- **`sitemap.xml`** — every indexable URL, with `<lastmod>` set from the build
  date (not a hardcoded date), realistic `changefreq`/`priority`.
- **Indexability:** no accidental `noindex`; return real **404** status on
  missing pages (and ship a branded 404 that links back into the site).
- **HTTPS everywhere**, with the redirect chain resolved: `http → https` and
  `www → apex` (or the reverse) should be a single redirect, and the canonical
  matches the final URL.
- **Security headers** (also a Best-Practices signal): `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security`,
  `Permissions-Policy`, and a `Content-Security-Policy` (start report-only, then
  enforce once clean).
- **Mobile-friendly + fast** — Core Web Vitals (Part A) *are* ranking factors.

### 3.3 Structured data (JSON-LD)

Schema tells search engines exactly what the page is. Use JSON-LD, and only mark
up what's **actually visible** on the page. Types we use on a local service site:

| Page | Schema |
| --- | --- |
| Home | `LocalBusiness` (or a subtype like `HouseCleaningService`) + `Organization` + `WebSite` + `FAQPage` |
| Services hub | `ItemList` + `BreadcrumbList` |
| Service page | `Service` + `BreadcrumbList` + `FAQPage` |
| About / Contact | `AboutPage` / `ContactPage` + `BreadcrumbList` |

- **`Organization` + `WebSite`** establish the brand as an entity (name, logo,
  `sameAs` links to GBP/social). Add them once, site-wide.
- **`LocalBusiness`**: name, `telephone`, `email`, `address` (or `areaServed`
  for a service-area business with no storefront), `geo`, `openingHours` *with
  times*, `priceRange`.
- **`FAQPage`** must match the visible Q&A **exactly**.
- **`sameAs`** — only point at *verified* profiles you own. Never guess.
- **Never** add `Review`/`aggregateRating` until you have real reviews.
- Validate at **search.google.com/test/rich-results** and validator.schema.org.

### 3.4 Content & E-E-A-T

Google rewards **E**xperience, **E**xpertise, **A**uthoritativeness,
**T**rustworthiness.

- **Match search intent.** A "deep cleaning Albany" page should explain deep
  cleaning, what's included, price signals, and area served — not be a thin stub.
- **Depth without padding.** Aim for genuinely useful pages (Albany's service
  pages run ~1,200–1,700 words). Don't keyword-stuff.
- **No thin or duplicate content**, and **no doorway pages** — do not spin up 30
  near-identical "cleaning in [city]" pages. If you make a location page, it must
  carry real local value (local landmarks, service specifics, real coverage).
- **Trust signals on the page:** licensed/insured, locally owned, service area,
  real testimonials (once you have them), guarantees, a real phone number.

### 3.5 Internal linking

- Every important page should be reachable in **≤ 3 clicks** from the home page.
- Link related pages to each other (service ↔ service, service → contact).
- Use **descriptive anchor text** ("deep cleaning services"), not "click here".
- No orphan pages (a page in the sitemap but linked from nowhere).

---

<a name="part-c"></a>
## 4. Part C — Local SEO (the big lever for service businesses)

For a local business, this often matters **more** than on-page SEO.

- **Google Business Profile (GBP)** is the #1 local ranking factor. Create it,
  verify it, fill it completely (categories, services, hours, photos, service
  area), and link it from the site footer + schema `sameAs`. Post updates.
- **NAP consistency** — Name, Address, Phone **identical** everywhere: site,
  GBP, and every directory. Even formatting drift ("Ste 5" vs "Suite 5") hurts.
  Make every `tel:` link and every displayed number the same.
- **Citations** — get listed in Bing Places, Apple Business Connect, Yelp, and
  relevant local/industry directories with matching NAP.
- **Reviews** — actively ask happy customers to review on Google. Review volume,
  recency, and responses are strong local signals. Respond to every review.
  *Then* (and only then) add real testimonials + `Review` schema to the site.
- **Local relevance in content** — mention the real service area, neighborhoods,
  and landmarks naturally.
- **Local business cross-linking** — if you run several local businesses, link
  them where it's genuinely relevant (a studio site linking the businesses it
  built) to show real local connections. Keep it honest and useful, not a link
  farm.

---

<a name="part-d"></a>
## 5. Part D — AI / generative search (GEO)

Search increasingly happens inside AI answers (Google AI Overviews, ChatGPT
search, Perplexity). Generative Engine Optimization:

- **Let AI crawlers in** via `robots.txt` (see 3.2).
- **`llms.txt`** — a plain-text business summary at the site root that gives AI
  engines clean, quotable facts (what you do, where, phone, services).
- **Write citably** — clear, factual, self-contained passages (a direct answer
  in the first sentence, then detail). FAQ sections are ideal — they map to how
  people ask AI questions.
- **Structured data + strong entity signals** (Organization/WebSite/sameAs) help
  AI engines associate facts with your brand confidently.
- Good technical SEO and clean content are the foundation — GEO is mostly "SEO
  done well, made machine-readable," not a separate discipline.

---

<a name="part-e"></a>
## 6. Part E — Measurement & tools

- **PageSpeed Insights** (pagespeed.web.dev) — CWV lab + field. Run mobile *and*
  desktop, 3× each, compare ranges.
- **Google Search Console** — submit the sitemap, watch Coverage/Indexing, see
  real queries, impressions, clicks, and position. The single most important SEO
  tool. Set it up on day one.
- **Google Analytics 4** — traffic and conversions (load it deferred, per 2.6).
- **Rich Results Test** + **Schema validator** — validate structured data.
- **Bing Webmaster Tools** — free, and feeds other engines.
- Re-test after every meaningful change; keep a before/after note.

---

<a name="part-f"></a>
## 7. Part F — The workflow

The repeatable order we use on every site:

1. **Build** to the design, with performance and semantics baked in (responsive
   images, one H1, clean structure) — not bolted on later.
2. **Optimize performance** (Part A) — images, CSS, fonts, JS, caching.
3. **Implement SEO** (Parts B–D) — metadata, schema, sitemap, robots, llms.txt.
4. **Audit** — run the full checklist below; fix Critical/High first.
5. **Launch** — verify redirects, live 404, rendered metadata, sitemap.
6. **Register** — Search Console (submit sitemap), GBP, GA4, Bing.
7. **Monitor & iterate** — watch CWV field data and Search Console; collect
   reviews; add content over time.

Fix in **severity order**: Critical (breaks indexing/conversions) → High → Medium
→ Low. Don't polish typography while the contact form is broken.

---

<a name="part-g"></a>
## 8. Part G — Checklists

### Performance
```
[ ] Photos: <picture> AVIF → WebP → fallback; small mobile source; correct sizes
[ ] LCP/hero preloaded + fetchpriority=high, NOT lazy
[ ] Below-fold images loading=lazy decoding=async
[ ] Every <img> has width + height (object-fit: cover)
[ ] No hidden-but-downloaded images on mobile
[ ] CSS minified; inlined (small) or critical-inlined (large); no render-block
[ ] Unused CSS rules / font weights removed
[ ] Fonts non-blocking or self-hosted; display=swap; only weights used
[ ] Analytics deferred to interaction/idle; first-party JS deferred
[ ] Third-party embeds lazy/deferred (chat, maps, booking)
[ ] Resize/scroll handlers rAF-batched (no forced reflow)
[ ] Static assets cached immutable; gzip/brotli on; favicons right-sized
[ ] 3× mobile + 3× desktop PSI runs; visually identical at 320/375/390/430px
```

### On-page SEO
```
[ ] Unique <title> ~50–60 chars, keyword-first, brand-last
[ ] Unique meta description ~140–160 chars
[ ] Exactly one <h1>; logical H2/H3
[ ] Self-referencing canonical
[ ] Open Graph + Twitter tags + 1200×630 preview image
[ ] Clean, shallow, hyphenated URLs; trailing slash consistent
[ ] Descriptive internal links; no orphans; important pages ≤3 clicks deep
```

### Technical SEO
```
[ ] robots.txt allows crawl + AI bots + points to sitemap
[ ] sitemap.xml complete, with dynamic <lastmod>
[ ] No accidental noindex; real 404 status + branded 404 page
[ ] HTTPS; single redirect for http→https and www→apex; canonical matches
[ ] Security headers (incl. HSTS, CSP)
[ ] Core Web Vitals pass (Part A)
```

### Structured data
```
[ ] Organization + WebSite site-wide
[ ] LocalBusiness with NAP/geo/hours(+times)/areaServed
[ ] Service / ItemList / BreadcrumbList / FAQPage as appropriate
[ ] FAQ schema matches visible Q&A exactly
[ ] sameAs → only verified owned profiles
[ ] NO Review/aggregateRating until real reviews exist
[ ] Validated in Rich Results Test
```

### Local SEO
```
[ ] Google Business Profile created, verified, fully filled, linked + sameAs
[ ] NAP identical on site, GBP, all directories (incl. tel: links)
[ ] Citations: Bing Places, Apple Business Connect, Yelp, industry dirs
[ ] Review generation process in place; respond to all reviews
[ ] Local relevance in content (service area, landmarks)
```

### Launch
```
[ ] Contact form posts to a real backend and a lead lands in an inbox
[ ] Phone visible + tap-to-call in header, footer, and mobile bar
[ ] Search Console verified + sitemap submitted
[ ] GA4 live (deferred)
[ ] GBP live and linked
[ ] Email deliverability: SPF + DKIM + DMARC all set (see appendix)
```

---

<a name="appendix"></a>
## 9. Appendix

### Core Web Vitals thresholds (field)

| Metric | Good | Needs work | Poor |
| --- | --- | --- | --- |
| LCP | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s |
| INP | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |

(Desktop lab thresholds are stricter, e.g. LCP good ≤ 1.2 s.)

### Email deliverability (why replies land in spam)

Three DNS records must all exist and align, or mail from the domain gets
filtered:
- **SPF** — TXT listing who may send (`v=spf1 include:_spf.google.com ~all`).
- **DKIM** — a cryptographic signature; generate the key in your mail provider's
  admin (e.g. Google Workspace → Apps → Gmail → Authenticate email), publish the
  TXT record, then turn authentication on. **This is the one most often missing.**
- **DMARC** — the policy (`v=DMARC1; p=none;` while you confirm alignment, then
  tighten to `quarantine`/`reject`). Starting at `p=reject` before DKIM is live
  can block your own mail.

### Common pitfalls we've hit

- A stale http.server serving old files → false "it didn't work" during testing.
  Kill old servers; verify with `curl` before trusting a screenshot.
- Declaring `const top` / other names that collide with `window` globals in inline
  scripts → the whole script throws silently. Test rendered output.
- Serving a page from the wrong directory in local testing → you screenshot a
  directory listing, not the site. Serve from the repo root.
- Raw curly quotes/em-dashes in a file served without a charset → mojibake
  (`â€"`). Use HTML entities or ensure UTF-8.
- Shipping an enforcing CSP untested → it silently blocks fonts/analytics. Start
  report-only.

### The non-negotiables (honesty)

- No fabricated reviews or ratings schema.
- No doorway/near-duplicate location pages.
- No invented street address in LocalBusiness schema.
- `sameAs` and citations only for profiles you actually own and have verified.

---

*Living document — update it as we learn. The checklists are the fastest way to
use it: run them before every launch.*
