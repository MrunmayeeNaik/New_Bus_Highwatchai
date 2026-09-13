# NewBus brand assets

Concept stage. Nothing here is wired into the app yet — `Header.jsx`, `Footer.jsx`
and `public/favicon.svg` are untouched pending a decision.

## Palette

| Token | Hex | Role |
|---|---|---|
| Midnight Navy | `#0B1A33` | Primary |
| Signal Teal | `#0E9A92` | Accent, light backgrounds |
| Teal Bright | `#2FD3C3` | Accent, dark backgrounds |
| Cool Paper | `#F4F7FA` | Light ground |

Chosen to avoid red/orange (redBus, AbhiBus), green (Fresh Bus, FlixBus — an EV
claim we can't back), purple (IntrCity), and stock Tailwind blue `#3b82f6`.

## Files

`concepts/` holds the icon for each of the five concepts, in light and dark variants.
All are 64×64 viewBox, no font dependency, no external references.

| Concept | Slug |
|---|---|
| 01 Route N — *recommended* | `01-route-n` |
| 02 Milestone | `02-milestone` |
| 03 Ticket Notch — *fallback* | `03-ticket-notch` |
| 04 Journey Arc | `04-journey-arc` |
| 05 Front Elevation | `05-front-elevation` |

`-light` = navy mark for light backgrounds. `-dark` = white mark for dark backgrounds.

## Not yet produced

Full lockups (icon + "NewBus" wordmark) as standalone SVGs. The wordmark is set in
Archivo ExtraBold, so a portable lockup file needs the text converted to outlines —
otherwise it renders in a fallback font on any machine without Archivo installed.
That gets done once a concept is chosen, rather than five times over.

Also pending: simplified small-size variant for 02 (its distance bars break below
24px), favicon, app icons, business card, social avatar.
