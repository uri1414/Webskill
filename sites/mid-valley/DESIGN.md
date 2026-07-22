# Design

<!-- impeccable:design-schema 1 -->

## World

**"The well-run building."** The finish of a professionally maintained facility, not a sparkle-clean maid cartoon. Institutional calm: deep navy authority, living sage green, warm stone-white ground, real photography of real work. The category default we refuse: cyan/teal + soap-bubble icons + "Sparkling!" swooshes + cartoon mascots. Mid-Valley reads as a credentialed contractor a city procurement officer AND a homeowner both trust.

## Color

Committed navy + sage on warm stone-white. Navy owns whole regions (header wordmark ink, dark CTA/footer bands, headings); sage is the living/eco accent (rules, badges, links, secondary button, section tints). Ground is warm stone-white — NOT cream. Light is the base scene (daytime homes and offices); navy bands provide the dark counterweight.

- `--navy: #1E2B4D` (ink, dark bands)
- `--navy-deep: #16213C` (footer, gradient floor)
- `--sage: #6E7E5F` (accent, badges, rules)
- `--sage-deep: #4E5B3C` (sage text on light — AA)
- `--sage-soft: #EAEDE3` (tint blocks)
- `--stone: #F5F4EF` (page ground)
- `--paper: #FFFFFF` (cards)
- `--ink: #1E2B4D` / `--body: #3C4353` (slate body) / `--muted: #6B7180`
- `--line: #E4E4DC` (hairlines)

## Type

- **Display:** Archivo (700/800), tight tracking — institutional, confident, load-bearing. Used for the wordmark echo, H1–H3.
- **Body/UI:** Public Sans (400/500/600) — the USWDS workhorse; a deliberate, legible, government-adjacent nod that also reads clean for homeowners.
- Neither font is a training-default display face. Scale steps obvious; H1 clamps to ~3.4rem desktop; tracking floor -0.03em on display.

## Composition & motion

- Generous stone whitespace; hairline dividers; 14–18px radii; soft real shadows (offset + blur), never colored halos.
- Photography leads the services (one real photo per service). No icon-tile card grid as the page skeleton.
- Motion: one authored moment — a soft, staggered rise-in of content as sections enter, exponential ease-out from a visible default. `prefers-reduced-motion` disables it. Buttons/links have real hover/focus states.

## Conversion

Header carries click-to-call + "Free Quote". Primary CTA is the "Request a Free Quote" form in a navy band near the foot. Credentials strip (Licensed & Insured · Locally Owned · Eco-Friendly) appears high.

## Uninvented facts

Phone, email, address, license numbers, years in business, testimonials, and review counts are NOT real — rendered as visibly-marked placeholders for the owner to replace. Never present them as confirmed.
