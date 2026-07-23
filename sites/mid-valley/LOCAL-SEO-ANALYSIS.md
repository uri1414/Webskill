# Local SEO Analysis — Mid-Valley Facility Services LLC

_Analyzed with the `seo-local` skill (March 2026 knowledge). Site: `sites/mid-valley/` single-page site._

## Local SEO Score: 74 / 100 (after this pass)

| Dimension | Weight | Status | Notes |
|---|---|---|---|
| GBP signals | 25% | ⚠️ Off-site | No Google Business Profile yet — biggest remaining lever (32% of local-pack weight). |
| Reviews & reputation | 20% | ⚠️ None yet | No reviews. Do **not** fabricate; build a real review flow (18-day cadence). |
| Local on-page SEO | 20% | ✅ Strong | City+service in title, NAP in footer, `tel:` links, service-area section, alt text. |
| NAP consistency | 15% | ✅ Consistent | Name/locality/phone now match across footer + schema (all placeholders, same values). |
| Local schema | 10% | ✅ Added | `HomeAndConstructionBusiness` + `Service` catalog + `geo` + hours + `areaServed`. |
| Local links & authority | 10% | ⚠️ Off-site | Pursue Chamber of Commerce, BBB, "best of" lists. |

**Business type:** Service-Area Business (SAB) — service-area language, no public street address.
**Industry vertical:** Home Services (cleaning / janitorial) — licensed/insured, free estimate, service area.

## What I implemented in this pass (on-page / technical)

1. **LocalBusiness structured data** (`HomeAndConstructionBusiness`, JSON-LD) with `@id`, telephone, `address` (Albany, OR), `geo` (44.63651, -123.10595 — 5-decimal), `openingHoursSpecification`, `areaServed` (10 Mid-Valley cities), and a `hasOfferCatalog` of the three services. Plus a `WebSite` node. **No `aggregateRating`** — no real reviews exist and inventing one violates Google policy + FTC rules.
2. **Geo meta tags** — `geo.region`, `geo.placename`, `geo.position`, `ICBM`.
3. **Open Graph + Twitter cards** — proper social/link previews with the residential photo.
4. **Canonical URL** + `robots` meta (`index, follow, max-image-preview:large`).
5. **`sitemap.xml`** with image entries.
6. **`robots.txt`** allowing all crawlers + major AI bots (GPTBot, OAI-SearchBot, PerplexityBot, Google-Extended) + sitemap reference.
7. **`llms.txt`** — structured business summary for AI search engines (GEO).

## Top prioritized actions (remaining)

**Critical (off-site — do these first)**
1. **Create & verify a Google Business Profile** — pick the correct primary category (e.g. "House cleaning service" / "Commercial cleaning service"), add 4 secondary categories, photos, and hours. This is the single biggest local-pack factor.
2. **Claim Bing Places** (powers ChatGPT, Copilot, Alexa) and **Apple Business Connect**.
3. **Replace all placeholders** — real domain, phone, email, and license/bond numbers (search the repo for `midvalleyfacility.com` and `555-0100`).

**High**
4. **Build a review engine** — ask every happy customer for a Google review; keep at least one new review every ~18 days. Respond to all reviews.
5. **Add dedicated service pages** — one page each for House / Commercial / Government cleaning (Whitespark's #1 local-organic factor). Right now they are anchor sections on one page.
6. **Citations** — consistent NAP on Yelp, BBB, Facebook, Nextdoor, Chamber of Commerce, plus data aggregators (Data Axle, Foursquare).

**Medium**
7. Add a **visible FAQ section** + `FAQPage` schema (helps AI Overviews cite you). Content must match the visible questions.
8. Add **city-specific landing pages** as you expand (Corvallis, Lebanon, Salem) — keep each >60% unique; avoid swappable "doorway" copy.
9. Pursue **local backlinks / "best of" lists** (top AI-visibility citation factor) and community sponsorships.

## Limitations (what this analysis could NOT assess)

Geo-grid rank tracking, Domain Authority / full backlink profile, live GBP Insights, real-time local-pack position, and Core Web Vitals field data — these need live tools (Google Search Console, PageSpeed/CrUX, or DataForSEO). Run `/seo-google` once the site is live and verified in Search Console, and `/seo-geo` for a full AI-search visibility pass.
