# Design System — Simworks Brand (from Figma Deck)

Source: [Simworks Figma Deck](https://www.figma.com/deck/CPiQfr2ll6anhYNVrcmodq/Simworks?node-id=2-123)

## 1. Visual Theme & Atmosphere

Simworks presents itself as a high-conviction, editorial brand: stark black-and-white contrast punctuated by warm, cinematic accent color. The deck alternates between two registers — **dark, cinematic "moment" slides** (cover, section dividers, taglines, testimonials) rendered in near-black with warm amber/terracotta studio lighting and a single cool blue accent, and **clean white "systems" slides** (data, pricing, process diagrams) that read like a product spec sheet. The tone is confident and slightly severe — bold condensed all-caps headlines against black, balanced by restrained, almost technical monospace labels and neutral body copy on the white slides.

Photography and 3D renders lean cinematic and metaphor-driven (a ladder through a skylight, a glowing cockpit, an AI hand reaching toward a human hand) rather than literal product screenshots — the brand sells a feeling (aspiration, judgment, readiness) before it sells a product.

**Key Characteristics:**
- Black-and-white foundation with sparing, deliberate color accents
- Heavy condensed all-caps grotesk for headlines/quotes — the brand's loudest voice
- Monospace uppercase for kickers, labels, tags, and step numbers — the brand's "systems" voice
- Neutral humanist sans for body copy and white-slide headings — the quiet, readable voice
- Warm cinematic renders (amber/terracotta lighting) as the emotional register
- A six-petal flower/hexafoil mark as the consistent brand anchor on every slide
- Green used exclusively as the "money/success" signal color (revenue flow, checkmarks)
- Thin hairline borders and minimal corner radius — systems feel precise, not soft

## 2. Color Palette & Roles

### Primary
- **Black** (`#000000`): Dominant dark background for cover/divider/moment slides
- **White** (`#ffffff`): Dominant background for content/data/pricing slides
- **Off-black text** (`#111111`–`#1a1a1a`): Headline text on white

### Accent
- **Terracotta / Amber** (approx. `#d98d5f`, `#e0a06e`): Cinematic lighting warmth in hero renders
- **Sky Blue** (approx. `#4a9fd8`): Single cool accent (skylight circle) cutting through warm scenes
- **Green** (approx. `#2f9e5f`): Reserved strictly for revenue flow, success checkmarks, positive signals
- **Gold / Bronze** (gradient, approx. `#8a6a3a` → `#d9b86a`): Credential/badge iconography

### Pastel Card Accents (icon/feature cards on white slides)
- **Blush Pink** (approx. `#f2d9e8`)
- **Lavender** (approx. `#ded4f2`)
- **Aqua Cyan** (approx. `#5fd8e6`)

### Neutral Scale
- **Mid Gray** (`#6b6b6b`): Secondary/body text, kicker labels
- **Light Gray** (`#e5e5e5`): Hairline borders, card dividers
- **Panel Gray** (`#f2f2f2`): Rounded process-step backgrounds on diagram slides

## 3. Typography Rules

### Font Families
- **Display / Headline**: Heavy condensed grotesk, all caps (visually consistent with Archivo Black / Anton) — used for taglines, quote overlays, section-divider titles
- **Content Heading**: Neutral humanist sans, regular-to-medium weight, mixed case (e.g. "Revenue Model") — used for white "systems" slide titles, noticeably less loud than the display face
- **Kicker / Label / Data**: Monospace, uppercase, wide letter-spacing — used for "SIMWORKS" wordmark lockup, eyebrow kickers ("PRICING", "FEEDBACK FROM USERS"), step numbers ("01", "02", "03"), and tier labels ("TIER WORK LITE")
- **Body**: Neutral sans-serif, regular weight — bullet copy, descriptions, footnotes

### Hierarchy

| Role | Style | Notes |
|------|-------|-------|
| Cover / Tagline | Condensed grotesk, all caps, ~40–56px | e.g. "WHERE JUDGMENT BECOMES YOUR RESUME." — tight leading, full-bleed on black |
| Quote Overlay | Condensed grotesk, all caps, ~24–32px | Overlaid on photography, wrapped 2–4 lines, white text |
| Section Divider Title | Condensed grotesk, all caps, ~40px | e.g. "DEMO", "BACKUP SLIDES" — paired with small mono wordmark above |
| Content Slide Heading | Humanist sans, regular/medium, ~32–40px | e.g. "Revenue Model", "A Self-Sustaining Marketplace..." — mixed case, not condensed |
| Stat / Big Number | Condensed grotesk, ~36–44px | e.g. "20-100+", "$49" — same voice as headlines even on white/black cards |
| Kicker Label | Monospace, uppercase, ~10–11px, wide tracking | e.g. "PRICING", "FEEDBACK FROM USERS" |
| Body | Sans-serif, regular, ~14–16px | Bullet lists, descriptions |

### Principles
- **Condensed caps = the emotional register.** Reserve the heavy condensed all-caps face for moments meant to land hard: taglines, pull quotes, big stats, section titles.
- **Monospace = the systems register.** Any label that reads as metadata, a tag, a step, or a tier uses uppercase monospace with wide tracking — it signals "this is structural, not narrative."
- **Humanist sans = the neutral register.** Content-slide headings and all body copy stay in a plain, mixed-case humanist sans so dense information stays legible and doesn't compete with the display voice.
- **Never mix registers within one text block** — a heading is either condensed-cap, humanist, or mono; not blended.

### Applying registers to the product app
The deck's "moment" (dark, all-caps) vs. "systems" (white, humanist) split doesn't map 1:1 onto the app's own two zones:
- **Marketplace, simulation library, and case workspace screens** are the app's white "systems" surface. Headings there use `font-display` — **Helvetica Neue / Arial at weight 800**, in **mixed/sentence case, never uppercase** — e.g. "Practice the work before you land the job.", "Choose a practice track.", card titles like "Month-End Close Under Pressure". This is the product's plain, heavy-weight systems voice; it is deliberately not condensed.
- **The one "moment" component embedded in a systems page** is the marketplace hero's black active-simulation card (`ContinueCard`). Its title alone uses `font-displayBold` — **Oswald**, condensed, weight 600 — the single place outside the Journey pages where the condensed display face appears. Never apply `font-displayBold` to a systems-page heading.
- **Journey pages** (`JourneyHero`, `IdeaSection`, `ConvergeSection`, `FinalistsSection`, `NextSection`, `IdeaExplorer`) are the deck-style "moment" surface and keep the full condensed all-caps Archivo Black treatment.
- Kicker/eyebrow labels (`SectionLabel`, "Explore pathways", "Simulation library") and step/case IDs stay uppercase monospace everywhere, per the systems register above.

### Cover art (case cards & the moment card)
- Every case cover — grid cards and the hero's active-simulation card alike — renders as a **striped diagonal gradient placeholder**, tinted by the case's category accent, with a small uppercase mono "Cinematic placeholder / [category] · cover" note top-right. No stock photography or hand-drawn art.
- Category accent colors (used for the cover gradient, the pathway-tab bar, and the small dot on each card): **Legal = bronze `#8a6a3a`**, **Accounting = terracotta `#c1673c`**, **Business analyst = sky blue `#4a9fd8`**, **Onboarding = gray `#6b6b6b`**.
- **Green (`#2f9e5f`) is reserved for live/success/ready signals only** — the "credential track live" dot, ready checklist states — never a category or cover color.

## 4. Component Stylings

### Brand Mark
- Six-petal flower/hexafoil, formed from overlapping circles, line-art only (no fill)
- White stroke on black slides, black stroke on white slides
- Fixed position: top-left on dark moment slides, top-right (small, corner) on white content slides
- Also used solid/white-filled inside the black "hub" node of process diagrams

### Cards (Feature / Icon Cards)
- Pastel-tinted rounded-rectangle background (blush pink, lavender, aqua) or plain photo
- Bold sans/condensed heading directly below image, all caps
- Checkmark (circled) + short body line per bullet
- No border — color block and whitespace define the edge

### Cards (Process / Diagram Nodes)
- Light gray (`#f2f2f2`) rounded rectangle for standard nodes
- Solid black rounded rectangle with white flower mark + mono label for the central "hub" node
- Black pill labels with white mono text for fee/cost annotations
- Green stroke + arrow for revenue-flow connectors; black dashed stroke for informational connectors

### Cards (Pricing Tiers)
- White background, 1px light-gray hairline border, minimal radius (~4–8px)
- Uppercase mono tier label, centered
- Large price in condensed/regular numeral, "per month" in small gray sans below
- Checkmarked feature list, left-aligned

### Testimonial Block
- Solid black rounded card floating on white background (split-screen layout)
- Condensed all-caps quote in white, opening/closing curly quotes
- Attribution in small plain sans below the quote
- Optional large stat ("20-100+") in condensed face beneath attribution, same card

### Quote Overlay (on photography)
- Bottom-aligned or lower-third, condensed all-caps white text with subtle drop shadow for legibility over image
- Curly quotation marks retained as literal characters

## 5. Layout Principles

### Grid & Composition
- Dark slides: generous negative space, subject/text anchored lower-third or left-aligned, brand mark isolated top-left
- White slides: left-aligned kicker + heading block, content below in 2–3 column grids
- Split-screen pattern: ~35/65 white-panel / full-bleed-image, used for testimonials and proof points
- Diagram slides: central black "hub" flanked by numbered input/output nodes with directional connectors

### Whitespace Philosophy
- Black slides use whitespace (blackspace) as drama — one line of type against a vast dark field
- White slides use whitespace as clarity — generous gutters between 3-column card grids keep dense info scannable

### Footer / Metadata Treatment
- Consistent vertical, rotated, small mono caption on the far right edge of every slide: `CONFIDENTIAL · [DATE]`
- Never competes with primary content — always low-contrast, edge-anchored

### Border Radius Scale
- Minimal (4px): Pricing card corners, black pill labels
- Standard (8px–12px): Process diagram nodes, feature/icon cards
- None (0px): Full-bleed photography, split-screen panels

## 6. Iconography & Imagery

- **Line icons only** for inline bullets (checkmark-in-circle, thumb-up-in-circle) — thin stroke, no fill
- **Badge icon**: hexagonal gold/bronze gradient credential badge with embossed flower-mark motif — used to signify achievement/verification
- **Photography**: warm, cinematic, real-people-in-real-settings (desk conversations, cockpit interiors) — avoid flat stock-photo lighting
- **3D renders**: metaphor-first (ladder/skylight, glowing cockpit) with dramatic single-source warm lighting and one contrasting cool element
- **World map outline**: thin white stroke-only continents on black, used as a scale/ambition motif behind taglines

## 7. Do's and Don'ts

### Do
- Reserve heavy condensed all-caps type for headlines, quotes, and big stats only
- Use uppercase monospace for every kicker, tag, tier label, and step number
- Keep content-slide headings in a plain humanist sans — don't make everything shout
- Anchor the flower mark consistently (top-left on dark, top-right on white)
- Use green only for revenue/success signals — never as a general accent
- Let black slides breathe with large areas of negative space
- Use warm cinematic lighting (amber/terracotta) with exactly one cool accent per scene
- Give every card in a selector/tab row the same visible hairline border (`rgba(0,0,0,0.08)`) whether or not it's the active choice — selection state should read from the fill/elevation, not from making unselected cards borderless

### Don't
- Don't apply the condensed display face to body copy or dense lists — it's for high-impact moments only
- Don't introduce additional accent colors beyond the defined pastel/green/blue/amber set
- Don't add heavy shadows or gradients to cards — the system relies on flat color blocks and hairline borders
- Don't round corners aggressively — this brand reads precise, not soft (max ~12px)
- Don't drop the mono-uppercase treatment for structural labels — it's what separates "data" from "narrative" in this system
- Don't mix quote-overlay text with busy image backgrounds — ensure enough dark contrast area for legibility

## 8. Agent Prompt Guide

### Quick Reference
- Dark hero/moment slide: black background, condensed all-caps white headline, flower mark top-left, mono caption bottom-right edge
- White content slide: white background, mono uppercase kicker, humanist sans heading, 2–3 column card grid
- Testimonial: black rounded card on white, condensed all-caps quote, plain sans attribution
- Diagram: light-gray nodes + black hub node (flower mark + mono label), green arrows for money flow

### Example Component Prompts
- "Create a dark cover slide: pure black background, six-petal flower mark line-icon top-left in white, condensed all-caps headline 48px centered lower-third, small mono 'CONFIDENTIAL · [DATE]' rotated on the right edge."
- "Design a pricing card: white background, 1px light-gray border, 8px radius. Mono uppercase tier label centered at top, large price numeral below, 'per month' in small gray sans, checkmarked feature list left-aligned."
- "Build a testimonial block: black rounded card (12px radius) on white page. Condensed all-caps white quote text, small plain-sans attribution line, optional large stat number below in the same condensed face."
- "Create a process diagram: light-gray rounded node boxes with mono step number ('01') and sans label, connected by black lines to a central black rounded hub containing the white flower mark and a mono label; use a green stroked arrow for the revenue-flow connector."

### Iteration Guide
1. Decide the register first — is this a narrative "moment" (black, condensed caps) or a "systems" slide (white, humanist + mono)?
2. Never blend condensed-caps and humanist-sans in the same text block
3. Kickers, tags, tiers, and step numbers are always uppercase monospace
4. Reserve green strictly for money/success signals
5. Keep corners minimal (≤12px) and borders hairline — precision over softness
6. Anchor the flower mark and the rotated mono footer caption on every slide for continuity
