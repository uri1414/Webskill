# Fast Website Starter

A pre-optimized, SEO-ready landing page for a local service business. Built to
score high on Core Web Vitals out of the box — inline critical CSS, deferred
analytics, responsive AVIF/WebP images, non-blocking fonts, structured data, a
working contact form, security headers, and a branded 404.

Pairs with the **Website Optimization & SEO Handbook** and the **Mobile
PageSpeed Playbook** — this is those docs turned into a real starting point.

```
fast-starter/
├── index.html        The landing page (all critical CSS/JS inlined)
├── 404.html          Branded 404 (noindex)
├── netlify.toml       Caching + security headers
├── robots.txt         Crawl rules + AI crawlers + sitemap pointer
├── sitemap.xml        One URL to start; add more per page
├── llms.txt           Plain-text business summary for AI search
└── assets/img/        Put your images + favicons here
```

## 1. Customize (find & replace)

Every editable value is a `{{TOKEN}}`. Search the whole folder and replace:

| Token | Example |
| --- | --- |
| `{{BUSINESS}}` | Albany Pro Cleaning |
| `{{DOMAIN}}` | https://albanyprocleaning.com  (no trailing slash) |
| `{{CITY}}` / `{{REGION}}` | Albany / OR |
| `{{PHONE_DISPLAY}}` / `{{PHONE_E164}}` | (541) 730-2894 / +15417302894 |
| `{{EMAIL}}` | info@albanyprocleaning.com |
| `{{GA_ID}}` | G-XXXXXXXXXX  (or delete the analytics block) |
| `{{LAT}}` / `{{LNG}}` | 44.6365 / -123.1059 |
| `{{PRIMARY_KEYWORD}}`, headline, FAQ, service copy | your real content |

Then swap the palette + fonts in the `:root` block of `index.html` to rebrand.

## 2. Add images

Drop these in `assets/img/` (see the handbook's image section):

- **Hero** — `hero-640/960/1280.avif` + matching `.webp` + `hero.jpg` fallback.
- **Services** — `service-1/-2/-3-440/-880.avif` + `.webp` + `.jpg`.
- **Favicons** — `favicon.ico`, `favicon-180.png`.
- **Share image** — `share-banner.jpg` (1200×630) and `logo.png`.

Generate AVIF/WebP with Pillow (v11.3+):

```python
from PIL import Image
im = Image.open("hero.jpg").convert("RGB")
for w in (640, 960, 1280):
    r = w / im.width
    s = im.resize((w, round(im.height*r)), Image.LANCZOS)
    s.save(f"assets/img/hero-{w}.avif", format="AVIF", quality=58, speed=4)
    s.save(f"assets/img/hero-{w}.webp", format="WEBP", quality=80, method=6)
```

## 3. Wire the form

The form is set up for **Netlify Forms** (`data-netlify`, hidden `form-name`,
honeypot). After deploy, open **Netlify → Forms → Settings** and turn on email
notifications so leads reach an inbox. To use another backend, remove the
`data-netlify` attributes and point the form's fetch at your handler URL.

## 4. Deploy

Any static host. On Netlify: connect the repo (or drag-drop the folder),
publish directory `.`, no build command. `netlify.toml` handles headers.

## 5. Launch checklist

- [ ] All `{{TOKEN}}`s replaced (grep for `{{` to confirm none remain)
- [ ] Real images added; hero exports present in all 3 formats
- [ ] Favicons + `share-banner.jpg` in place
- [ ] Form notifications turned on; test a real submission
- [ ] `sitemap.xml` `<lastmod>` set; submit it in Google Search Console
- [ ] Deploy, then run PageSpeed Insights (mobile + desktop, 3× each)
- [ ] Create/link the Google Business Profile; add its URL to schema `sameAs`
- [ ] SPF + DKIM + DMARC set for the domain's email

## Why it's already fast

- Critical CSS inlined → no render-blocking stylesheet request
- Hero preloaded (AVIF, `fetchpriority=high`); below-fold images lazy
- Every image has width/height → ~zero layout shift
- Fonts load non-blocking with `display=swap`
- Analytics deferred to first interaction/idle → main thread free at load
- Static assets cached immutable; security headers set

See the handbook for the full reasoning behind each choice.
