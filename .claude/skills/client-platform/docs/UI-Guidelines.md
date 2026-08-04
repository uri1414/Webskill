# UI Guidelines — Baseline Practice OS

The interface has to read at a glance for a busy front desk and reassure a client who isn't technical. Clarity over cleverness.

## Design tokens
- Drive everything from tokens (`tailwind.config.ts` + CSS variables): brand color, neutrals with a slight brand-biased hue, semantic status colors, spacing scale, type scale, radius.
- **Semantic status colors are separate from the brand accent**: good/green, warning/amber, critical/red, neutral/slate, info/blue. Status color never doubles as the brand accent.
- Two typefaces max (a display face used with restraint + a readable body face); a mono face for identifiers/data where it carries meaning.
- Per-client theming = swap token values only; component code doesn't change.

## Accessibility
- Contrast: text ≥ 4.5:1, large text/UI ≥ 3:1, in **both** light and dark themes.
- Visible keyboard focus on every interactive element; logical tab order.
- Real labels on inputs (not placeholder-as-label); errors linked to their field.
- Respect `prefers-reduced-motion`; don't encode meaning in color alone — pair a color with a word or icon.
- Semantic HTML (headings, lists, `<main>`, buttons that are buttons).

## Clear status labels
- Show a human stage, not a raw enum: "In review", not `in_review`. Map every status to a friendly label + a status color once, centrally.
- A status pill/chip encodes state in **form + color + word** so it reads at a glance and survives color-blindness.
- The client sees client-appropriate language ("We're preparing your return"); staff can see the precise state.

## Timeline & progress indicators
- Client-facing engagements get a **timeline/progress rail** built from `activity_events` — what's done, what's now, what's next. This is the client portal's core reassurance.
- Use real sequence only where order is real (the workflow stages). Don't fake numbered steps on things that aren't a sequence.
- Show the *current* stage prominently; keep history one tap away.

## Advisory vs. administrative actions
- **Distinguish advisory actions from administrative actions.** Administrative/workflow actions (schedule, check in, mark complete, take payment) use primary/standard styling. Anything that could read as professional tax advice is presented as **information or a prompt to talk to the CPA**, never as an automated ruling.
- The software organizes work; it does not render tax judgment. Copy and buttons must not imply the system is giving professional advice. Keep a clear line between "here's your status" and "here's tax guidance from your CPA."

## Paid consultation prompts
- Make paid-consult prompts **clear but not aggressive**: state the fee, what the client gets, and a single obvious action. No dark patterns, no repeated nagging, no pre-checked upsells.
- One honest prompt at the right moment beats persistent banners. The client should never feel tricked into a charge.

## Notifications & sensitive information
- **Don't expose sensitive information in notifications.** A notification says *that* something happened and links into the authenticated app; it does not carry documents, tax figures, SSNs, balances, or other sensitive detail in the body/subject.
- Assume notifications surface on lock screens and in inboxes. "A document was reviewed on your return — open your portal to view" — never the content itself.
- Same rule for email/SMS: link to the gated app; never put the sensitive payload in the message.

## Responsive portal behavior
- Mobile-first for client and receptionist; the day view and check-in must work at tablet width.
- Sidebar → `MobileNav` on small screens; wide content (tables, timelines) scrolls inside its own container, never the page body.
- Theme-aware (light/dark) with both themes given equal care.
