# Mobile PageSpeed Optimization Playbook

A field-tested checklist for making a static (or mostly-static) website load
faster on mobile — built from the work that took **albanyprocleaning.com from a
mobile PageSpeed score of 69 to 86**, with Best Practices 100, SEO 100,
Accessibility 96, TBT 0 ms, and CLS 0.013.

Use it as a reference when optimizing other sites. Everything here is
framework-agnostic — the techniques apply to plain HTML, Netlify/Cloudflare
static hosting, or any build that outputs HTML/CSS/JS.

---

## The one idea behind all of it

A mobile PageSpeed score is dominated by **how little the browser has to do
before it can paint the screen**, measured under a deliberately slow simulation
(≈4× slower CPU, throttled "slow 4G"). So every fix below does one of three
things:

1. **Send fewer bytes** (especially images).
2. **Remove things from the critical path** (the chain of requests that blocks
   the first paint).
3. **Keep the main thread free** during load (defer non-essential JavaScript).

If a change doesn't do one of those three, it won't move the score.

---

## Results: before → after

| Metric | Before | After | Notes |
| --- | --- | --- | --- |
| Performance (mobile) | 69 | **86** | Target band is 85–95+ |
| Total Blocking Time | high | **0 ms** | Deferring analytics did this |
| Cumulative Layout Shift | — | **0.013** | Image dimensions + no late inserts |
| First Contentful Paint | slow | 3.2 s | The remaining ceiling (see "What's left") |
| Largest Contentful Paint | slow | 3.2 s | Paints with FCP — healthy |
| Best Practices / SEO | — | **100 / 100** | |

---

## The fixes, in priority order

Ranked by impact-per-effort. **Do images first** — on almost every site,
image bytes are the single biggest win.

### 1. Serve modern image formats (AVIF, then WebP, then a fallback)

**Why:** Photos are usually 60–80% of a page's weight. AVIF is ~30–50% smaller
than WebP and ~50–70% smaller than JPEG at the same quality.

**How:** Give every photo a `<picture>` with sources the browser picks from
top-down — AVIF first, WebP next, and a JPEG/PNG in the `<img>` as the universal
fallback:

```html
<picture>
  <source type="image/avif" srcset="/img/hero-640.avif 640w, /img/hero-960.avif 960w, /img/hero-1280.avif 1280w" sizes="100vw">
  <source type="image/webp" srcset="/img/hero-640.webp 640w, /img/hero-960.webp 960w, /img/hero-1280.webp 1280w" sizes="100vw">
  <img src="/img/hero.jpg" alt="…" width="1931" height="814" decoding="async">
</picture>
```

Real numbers from this project (AVIF vs the matching WebP): hero 84 KB → 53 KB,
badge 74 KB → 34 KB, service photos ~30% lighter across the board.

**Generate them with anything you have** — `cwebp`/`avifenc`, ImageMagick, or
Python's Pillow (v11.3+ has native AVIF):

```python
from PIL import Image
im = Image.open("hero.jpg").convert("RGB")
im.save("hero-960.avif", format="AVIF", quality=58, speed=4)  # quality ~55–62 is visually lossless for photos
```

### 2. Give mobile a smaller image than desktop

**Why:** A phone at 390 px CSS width should never download a 1920 px desktop
image. `srcset` width descriptors + `sizes` let the browser pick the smallest
source that still looks sharp at the device's pixel density.

**How:** Add a small width (e.g. `640w`) to the `srcset` and set `sizes`
accurately. `sizes="100vw"` for a full-bleed hero; for a card grid, describe the
real layout: `sizes="(min-width:1200px) 25vw, (min-width:700px) 50vw, 100vw"`.

**Watch for hidden desktop imagery:** if a decorative image is `display:none` on
mobile, the browser *still downloads it*. Either don't render it on mobile or
serve it a tiny source. (On this site a badge was an eager 74 KB image shown at
150 px on phones — a pure waste until it was shrunk.)

### 3. Prioritize the LCP image, lazy-load the rest

**Why:** The Largest Contentful Paint element (usually the hero) should start
downloading immediately; everything below the fold should wait so it doesn't
compete for bandwidth.

**How:**
- On the LCP image: `fetchpriority="high"`, and **no** `loading="lazy"`.
- Preload it in `<head>` so it starts before the parser reaches it:
  ```html
  <link rel="preload" as="image" type="image/avif"
        href="/img/hero-640.avif"
        imagesrcset="/img/hero-640.avif 640w, /img/hero-960.avif 960w, /img/hero-1280.avif 1280w"
        imagesizes="100vw" fetchpriority="high">
  ```
  (`imagesrcset`/`imagesizes` make the preload pick the same responsive source
  the `<picture>` would — so you preload the *right* width, not a wasted one.)
- On every below-the-fold image: `loading="lazy" decoding="async"`.

### 4. Always set `width` and `height` on images (kills layout shift)

**Why:** Without dimensions the browser doesn't reserve space, so content jumps
when images load — that's Cumulative Layout Shift, a Core Web Vital.

**How:** Set the intrinsic `width`/`height` attributes (the browser derives the
aspect ratio and reserves the box). Use CSS `object-fit: cover` to crop into the
displayed shape without distortion. This project's CLS is **0.013** almost
entirely because of this rule.

### 5. Don't let CSS block the first paint

**Why:** An external `<link rel="stylesheet">` is *render-blocking* — the
browser won't paint until it's downloaded and parsed. On a high-latency mobile
connection that's a full round-trip of delay.

**How (two good options):**
- **Small sites:** inline the whole minified stylesheet in a `<style>` tag and
  drop the external link. This site's CSS is ~22 KB minified / ~5 KB gzipped —
  inlining removes one render-blocking request entirely with zero visual change.
- **Large sites:** inline only the "critical" above-the-fold CSS and load the
  rest asynchronously.

Either way, **minify the CSS** (this site: 34 KB → 22 KB via `rcssmin`; any
minifier works) and drop unused rules/font weights.

### 6. Load web fonts without blocking, or self-host them

**Why:** Google Fonts served cross-origin means the browser opens new
connections (DNS + TCP + TLS) to `fonts.googleapis.com` and `fonts.gstatic.com`
before styled text can appear — pure latency on mobile.

**How (good → better):**
- **Non-blocking load** — fetch the font CSS as a low-priority "print"
  stylesheet, then flip it to `all` once it arrives, with a `<noscript>`
  fallback. `display=swap` paints fallback text instantly so nothing waits:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=…&display=swap">
  <link rel="stylesheet" media="print" onload="this.media='all'" href="https://fonts.googleapis.com/css2?family=…&display=swap">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=…&display=swap"></noscript>
  ```
- **Self-host** the woff2 files from your own domain (with a long cache). This
  removes the cross-origin connections entirely and is the highest-leverage
  remaining FCP fix on most mobile sites.
- **Request only the weights you actually use.** Every extra weight is another
  font file. (This site dropped an unused Montserrat 500.)

### 7. Defer analytics and other third-party JS

**Why:** Tag managers and analytics (gtag.js ≈ 66 KB) run on the main thread and
inflate Total Blocking Time during the exact window PageSpeed is measuring — for
data you don't need in the first three seconds.

**How:** Queue the analytics call immediately (so no pageview is lost), but load
the heavy script only on the first user interaction or after an idle timeout:

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXX');
  (function () {
    var loaded = false;
    function load() {
      if (loaded) return; loaded = true;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX';
      document.head.appendChild(s);
    }
    ['scroll','mousemove','touchstart','click','keydown'].forEach(function (e) {
      window.addEventListener(e, load, { once: true, passive: true });
    });
    setTimeout(load, 3000); // fallback so a no-interaction visit still records
  })();
</script>
```

This single change is what took Total Blocking Time to **0 ms** here. Also load
your own site scripts with `defer`.

### 8. Fix "forced reflow" (layout thrashing)

**Why:** JavaScript that *reads* layout (`offsetWidth`, `innerWidth`,
`getBoundingClientRect`) right after *changing* the DOM forces the browser to
re-calculate layout synchronously — flagged as "forced reflow."

**How:** Batch the read into a `requestAnimationFrame` and coalesce bursts of
high-frequency events (resize/scroll) with a "ticking" flag:

```js
var ticking = false;
window.addEventListener('resize', function () {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(function () {
    ticking = false;
    if (window.innerWidth >= 900) { /* read + act here */ }
  });
}, { passive: true });
```

### 9. Cache static assets aggressively

**Why:** Repeat visits and multi-page journeys shouldn't re-download unchanged
assets.

**How:** Serve fingerprinted/static assets with a long immutable cache. On
Netlify (`netlify.toml`):

```toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 10. Right-size favicons and other "small" files

**Why:** Easy to overlook. This site shipped a **183 KB** 512×512 favicon PNG
that nothing needed — deleting it was free weight savings. An `.ico` plus
16/32/180 px PNGs covers every browser tab and touch icon.

---

## How to measure (so your numbers mean something)

- Test at **PageSpeed Insights** (pagespeed.web.dev), **Mobile** tab.
- **Run it 3+ times and compare the range** — lab scores swing several points
  run to run. Don't celebrate or panic over a single run.
- **Lab vs. field:** "No Data" under *Discover what your real users are
  experiencing* just means the site doesn't have enough traffic yet for Google's
  field data (CrUX). Lab numbers are worst-case simulation; real phones are
  usually faster.
- **Re-test desktop after** a mobile pass to confirm you didn't regress it.
- Verify the page is **visually identical** before/after at real mobile widths
  (320 / 375 / 390 / 430 px) — speed work should never change the design.

---

## Copy-paste checklist

```
IMAGES
[ ] Every photo is <picture> with AVIF → WebP → JPEG/PNG fallback
[ ] srcset width descriptors + accurate sizes; a small (~640w) mobile source
[ ] LCP/hero: preload + fetchpriority="high", NOT lazy
[ ] All other images: loading="lazy" decoding="async"
[ ] Every <img> has width + height (object-fit: cover to crop)
[ ] No large image is hidden-but-downloaded on mobile

CSS
[ ] Minified
[ ] Inlined (small sites) or critical-CSS inlined + rest async (large sites)
[ ] No render-blocking external stylesheet in <head>
[ ] Unused rules / font weights removed

FONTS
[ ] Loaded non-blocking (media=print onload) OR self-hosted woff2
[ ] display=swap
[ ] Only the weights actually used are requested
[ ] preconnect to font hosts if using a font CDN

JAVASCRIPT
[ ] Analytics/tag managers deferred to interaction or idle
[ ] First-party scripts use defer
[ ] No layout reads right after DOM writes (rAF-batch resize/scroll handlers)

DELIVERY
[ ] Static assets cached immutable (max-age=31536000)
[ ] Favicons/icons right-sized; no oversized stragglers
[ ] HTML compressed (gzip/brotli) — most hosts do this automatically

VERIFY
[ ] 3+ mobile PageSpeed runs, compared as a range
[ ] Desktop re-checked for regressions
[ ] Visually identical at 320/375/390/430px
```

---

## What was left on the table here (and why 86, not 95)

On this site, FCP and LCP both sit at **3.2 s** — and being *identical* is the
tell: the largest element paints at first paint, so there's no slow image
dragging LCP behind. The whole ceiling is time-to-first-paint under the mobile
simulation. The highest-probability next move is **self-hosting the fonts**
(fix #6, "better" tier) to remove the two cross-origin connections still in the
critical path — the change most likely to pull FCP under 3 s and push the score
into the low 90s.

The lesson for reuse: **once TBT is 0 and CLS is green, further gains come from
shortening the critical path (fonts, TTFB, hosting), not from more JavaScript
trimming.**
