# Local SEO Playbook

A repeatable process for building SEO-optimized, lead-generating local business
sites. This is the method used across our sites (Albany Junk Removal, Baseline
Studio, Mid-Valley Facility Services). Follow it for every new site.

---

## The core idea

Google ranks **individual pages**, not whole sites, for specific searches. A
single page that tries to rank for many services or cities competes with itself
and wins none of them. So the strategy is **one page per search intent**, each
fully optimized for a single keyword theme.

Dedicated service pages are consistently cited as the **#1 local-organic ranking
factor**. City/service-area pages capture "service + city" searches for towns you
serve but aren't physically located in.

**Two golden rules underneath everything:**
1. Every page must be **genuinely unique and useful** — never templated filler.
2. Every page's **visible content must match its structured data** (schema).

---

## 1. Service pages — process

Goal: capture people searching for a *specific* service.

1. **Inventory the services** the business actually offers.
2. **One page per service** at a clean, keyword-friendly URL
   (e.g. `/services/house-cleaning/`, `/mattress-removal/`).
3. **Target "service + location"** in the copy — e.g. H1 =
   "House Cleaning in Albany & the Mid-Willamette Valley."
4. **Write unique content** for each page (see template below). Never reuse a
   template with only the service name swapped.
5. **Add structured data**: `Service` + `BreadcrumbList` + `FAQPage`.
6. **Wire up internal links**: a Services hub page, the Services dropdown in the
   nav, "Related services" links, and footer links.
7. **Add the new URLs to `sitemap.xml`.**

### Service-page content template

- Breadcrumb (Home › Services › This service)
- Hero: eyebrow, one keyword-led H1, one-sentence lead, two CTAs (quote + call)
- Intro: 2 short paragraphs (what it is + who it's for)
- "What's included": a scannable checklist
- "Why choose us": credentials and differentiators
- FAQ: 3–4 questions (targets long-tail queries and AI answers)
- Related services + a sticky "Request a quote" card

---

## 2. Service-area (city) pages — process

Goal: capture "service + *city*" searches for towns in the service area.

1. **List the target cities** in the service area.
2. **One page per city** at a URL like `/junk-removal-corvallis-or/`.
3. **Make each page genuinely unique (>60% distinct).** Mention real local
   specifics — neighborhoods, landmarks, "we cover X and Y."
   > ⚠️ If you swap only the city name into identical copy, Google treats the
   > pages as **doorway pages** and can penalize you. This is the #1 city-page
   > mistake.
4. **Schema with `areaServed`** set to that city.
5. **Link from a "Service Area" dropdown** in the nav + the footer.
6. **Add to `sitemap.xml`.**

Same mechanics as service pages; the difference is the keyword axis is geography,
and the extra caution is uniqueness.

---

## 3. Requirements for EVERY page (checklist)

### Metadata / head
- [ ] One **unique `<title>`** (~50–60 chars): keyword + location + brand
- [ ] One **unique meta description** (~150–160 chars), written to earn the click
- [ ] **Canonical URL** (self-referencing)
- [ ] **Open Graph + Twitter** tags (link previews)
- [ ] **Geo meta** (region, placename, position, ICBM) — for local businesses

### Content / structure
- [ ] Exactly **one `<h1>`**, keyword-led, matching the page's intent
- [ ] Logical **H2/H3** hierarchy
- [ ] **Unique body content** — no thin or duplicated copy
- [ ] **Breadcrumb** (visible *and* as `BreadcrumbList` schema)
- [ ] **FAQ** with `FAQPage` schema — schema must match the visible Q&A exactly
- [ ] A clear **conversion path**: visible phone (`tel:` link) + a quote form

### Structured data (JSON-LD), matched to page type
- Homepage → `LocalBusiness` (with `areaServed`, hours, service catalog)
- Service page → `Service` + `BreadcrumbList` + `FAQPage`
- Hub page → `ItemList`
- City page → `Service` / `LocalBusiness` with `areaServed` = that city

### Technical / performance
- [ ] **Internal links in and out** (nav dropdown, related, hub, footer)
- [ ] **Images**: descriptive `alt`, `width`/`height` set (prevents layout
      shift), `loading="lazy"`, modern format (WebP)
- [ ] **Mobile-responsive**, fast-loading (minimal JS, no heavy build step)
- [ ] **Honest content** — no invented reviews, ratings, or credentials.
      Fake `aggregateRating` violates Google + FTC rules.

### Site-wide (required, not per-page)
- [ ] `sitemap.xml` listing every URL (with `lastmod`)
- [ ] `robots.txt` allowing search + AI crawlers, pointing to the sitemap
- [ ] `llms.txt` — plain-text business summary for AI search engines
      (ChatGPT, Perplexity, Google AI Overviews)
- [ ] HTTPS + clean folder-style URLs (`/services/house-cleaning/`)

---

## 4. Post-launch

- Submit `sitemap.xml` in **Google Search Console** and request indexing for new
  URLs.
- Set up **Google Analytics 4** (`gtag.js` in every page's `<head>`).
- Create/verify a **Google Business Profile** (biggest local-pack factor) and
  claim **Bing Places** + **Apple Business Connect**.
- Build a **review flow** — real reviews only; respond to all of them.
- Pursue **local citations** (Yelp, BBB, Chamber of Commerce) with consistent
  NAP (Name, Address, Phone).

---

## Quick launch checklist for a new site

1. Homepage with `LocalBusiness` schema, geo meta, CTAs.
2. One service page per service (`Service` + `BreadcrumbList` + `FAQPage`).
3. A Services hub page (`ItemList`) + Services dropdown nav.
4. City pages for each served town (unique content, `areaServed`).
5. `sitemap.xml`, `robots.txt`, `llms.txt`.
6. Run the per-page checklist on every page.
7. Deploy, then do the post-launch steps.
