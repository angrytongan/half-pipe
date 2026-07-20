# Ramp construction

Sources:
- https://diyskate.com/mini_03.html — 3ft mini ramp/half-pipe build
- https://diyskate.com/ramp_foundation.html — footings/foundations

The sections below "Quarter-pipe framing" through "Half-pipe as a special
case of quarter-pipe" are general/common DIY skate-ramp-building practice
(the kind of knowledge shared across ramp-building forums, plans, and build
guides), not a citation to a single published spec. Unlike
`../obstacle/research/rollers.md` (which quotes OSHA/Velosolutions numbers
directly into its BOM math), the figures in those sections — rib spacing,
ply thicknesses — are typical ranges/rules of thumb, not numbers to
hard-code into a calculation without finding and citing an actual span
table or product spec first. Treat that part as orientation for the
construction-method work, not as the sourcing that work will ultimately
cite — that role is filled by the cited reference build below instead,
sourced from the two pages listed above.

## Quarter-pipe framing

- **Ribs/transoms** are the load-bearing skeleton — one per interval across
  the ramp's width, each cut to the exact transition profile (flat run-in,
  curve, vert extension, deck — the same profile this app already generates
  parametrically). Typically 3/4" plywood, often doubled/laminated where a
  rib takes concentrated load (rider weight lands close to a single rib).
  Typical spacing is roughly 12–16" (300–400mm) — closer spacing for
  thinner skin ply or heavier expected use, wider spacing gets away with
  less material but skin flexes more between ribs.
- **Ledgers/stringers** are horizontal members tying the ribs together —
  along the base, at deck height, and often at intervals up the curve —
  so the skin isn't spanning unsupported between ribs at those points too.
- **Bracing**: diagonal kickers/braces at the base and back, needed once a
  ramp gets tall or goes vertical (a rider's weight applies real lateral/
  racking load high up a vert wall). A squat mini-ramp (shallow transition,
  little or no vert extension) mostly doesn't need it — low center of
  force, short lever arm, ribs and ledgers alone hold it square.

## Skin

- Two layers, almost always: a structural layer (3/4" plywood, sometimes
  OSB on a flat deck) and a **bending-grade layer** (1/4"–3/8" "luan" or a
  ramp-specific bending ply) over the curved transition, since 3/4" ply
  won't bend to a tight radius without cracking.
- **Radius drives bending-ply thickness** — the tighter the curve, the
  thinner the ply has to be to bend without cracking, or thicker ply has to
  be kerf-cut (a series of parallel cuts partway through the back face) to
  force a bend it otherwise couldn't make. This is a real physical
  constraint the current geometry (`radius` as a free slider) doesn't
  reflect at all.
- A **Masonite or Skatelite topsheet** over the plywood gives a smooth,
  low-friction, wear-resistant riding surface — the plywood itself isn't
  meant to be ridden on directly long-term.

## Coping

- Bolted/lag-screwed to the top rib right at the deck/transition lip —
  usually 2" schedule 40 steel pipe (matches this app's `COPING_RADIUS`),
  sometimes angle iron instead for a different grind feel ("pool coping").
- **This project's mounting method is not yet decided** — see the
  "Deviation" callout under Coping in the cited reference build below
  before assuming either of that source's two methods applies here.

## Deck

- Its own small joist frame at the top (like a mini floor), topped with
  3/4" plywood, usually finished with a toe-kick or fascia board to hide
  the joist ends and give a clean edge to step up to.

## Fasteners

- Deck screws throughout, staggered — never nails. Nails back out under
  the repeated flex/vibration of being skated on; screws hold.

## Half-pipe as a special case of quarter-pipe

A half-pipe is two quarter-pipe transitions, mirrored, joined by a flat
bottom — structurally as well as geometrically. Concretely:

- **Each side is a full quarter-pipe rib set** — same ribs, same spacing
  logic, same skin/coping/deck treatment, independently for each side. None
  of the quarter-pipe construction knowledge above needs re-deriving for a
  half-pipe; it applies twice, unchanged.
- **What's actually new is the flat bottom's own framing** — its own
  ledger/joist run at ground level connecting the two rib sets, sized for
  the `flatBottomLength` gap between them. This is the one piece of
  structure a quarter-pipe alone doesn't have.
- **The quarter-pipe's "back panel" doesn't exist on a half-pipe.** In this
  app's geometry, `buildQuarterPipeGeometry` closes its outline with a
  vertical face at the deck's outer edge dropping to the ground — that's a
  rendering convenience (a closed 2D shape for `ExtrudeGeometry`), not a
  structural wall. A real quarter-pipe likewise has no back wall on the
  underside of the transition — it's open framing back there, not skinned.
  A half-pipe doesn't need this piece reasoned about differently at all;
  there was never a "back" to remove, just an outline-closing edge in the
  geometry that a half-pipe's outline closes differently (mirrored
  transition instead of a straight drop).

So a half-pipe's construction BOM, when it exists, should be able to build
directly on a quarter-pipe's per-side calculation (ribs, skin, coping, deck)
run twice, plus one additional flat-bottom framing calculation — not a
parallel/duplicate construction model.

## Cited reference build: DIYskate 3ft mini ramp

A fully worked, cited example of the above, from
[diyskate.com/mini_03.html](https://diyskate.com/mini_03.html): a real
half-pipe built exactly as described in "Half-pipe as a special case of
quarter-pipe" — two mirrored transition sections plus one flat-bottom
section. Metric first, original imperial in parentheses.

**Important caveat on the numbers**: this build is one specific size —
0.91m tall, 1.83m transition radius, 2.44m wide. Its rib spacing, exact
rib counts, and cut lengths are all sized for *that* geometry. This app
lets `radius`/`width`/`flatBottomLength`/etc. vary freely, so **the
spacing numbers below are illustrative, not a rule to generalize** — the
*method* (evenly-spaced ribs cut from a trammel-marked template, doubled
at plywood seams, separate flat-bottom framing) is what carries over;
deriving spacing for an arbitrary size is a separate problem to solve
later.

### Overall dimensions

- Height (ground to deck top): 0.91m (3ft)
- Width: 2.44m (8ft)
- Length (both decks included): 7.32m (24ft)
- Transition radius: 1.83m (6ft)

### Curve marking (trammel method)

- The transition curve is drawn with a **trammel**: a 2.44m (8ft) long
  2x4 with a pencil-diameter hole (~9.5mm/3/8") drilled near one end,
  measured out to the transition radius (1.83m/6ft here) from a pivot
  screw — the 2x4 acts as a giant compass.
- After drawing the curve, a straight edge marks deck height (0.895m/2'-11
  1/4" up) and the coping notch (32mm × 44mm / 1 1/4" × 1 3/4").
- One rib is cut from 19mm (3/4") plywood and used as a template to trace
  the remaining ribs, rather than marking each one from scratch.

### Framing

**Transition sections (2, mirrored):**
- 34 × 2x4 (38×89mm nominal) at ~2.40m (7'-10 1/2") length per section
  (17 per 2.44m/8ft-wide side)
- 2 × 2x4 at 0.84m (2'-9") long, positioned under the deck framing for
  extra support
- Spaced ~203mm (8") on center in this build
- Doubled 2x4s wherever a plywood seam lands on the riding surface, for
  seam support

**Flat-bottom section:**
- 15 × 2x4 at 2.36m (7'-9") length
- 2 × 2x4 at 2.44m (8ft) for the sides
- Also spaced ~203mm (8") on center
- Pre-drill with a ~4.8mm (3/16") bit to prevent splitting

### Skin

Three effective layers, split differently between deck and transition:

- **Deck**: 19mm (3/4") plywood first layer, cut to 0.84m (2'-9") wide,
  screwed with 41mm (1 5/8") screws spaced ~0.3m (1ft) apart; then a
  second 9.5mm (3/8") plywood layer on top, seams offset from the first,
  same screw spacing.
- **Transition**: 9.5mm (3/8") plywood only (no 19mm structural layer —
  it won't bend to a 1.83m radius) — two sheets per side plus one
  ~1.22m-wide (4ft) center sheet, same 41mm screws at the same spacing.
  This is the concrete example behind this document's general "Skin"
  section note that transition ply must be thin enough to bend.
- **Topsheet (both deck and transition)**: five sheets of 6mm (1/4")
  masonite over everything, countersunk screws, sheets gapped 1.6–3.2mm
  (1/16"–1/8") apart to allow for thermal expansion without bubbling.

### Coping

- 60mm OD (2 3/8", the actual OD of nominal "2-inch" pipe), schedule 80
  black steel pipe, 5.6mm (7/32") wall thickness — schedule 40 noted as a
  cheaper, thinner-wall alternative. Two 2.44m (8ft) lengths, cut with a
  carbide blade.
- **Mounting method 1 (screws)**: 9.5mm (3/8") hole drilled through the
  outside face of the pipe, 4.8mm (3/16") through the inside face, holes
  marked 76mm (3") from each end and every 0.61m (2ft) between; pipe
  seated in the coping notch and screwed down snug into the rib below.
- **Mounting method 2 ("clothesline hook" bolts)**: 9.5mm (3/8") holes in
  the backing 2x4, 38mm (1 1/2") down from the top, 152mm (6") from each
  end, plus two more at 0.71m (2'-4") spacing in between, drilled at a
  slight downward angle; a 76mm (3") long, 9.5mm (3/8") diameter hook
  bolt through each hole with a nut and washer.
- **Deviation**: this project will use neither method as described —
  no holes drilled through the front/outside face of the pipe, and no
  screw mounting. A different mounting method will be described later;
  until then, treat coping mounting as an open question, not settled by
  this source.

### Foundations/footings

From [diyskate.com/ramp_foundation.html](https://diyskate.com/ramp_foundation.html)
— not covered on the mini-ramp page itself, but needed wherever a ramp
doesn't sit on an existing slab:

- A footing is the post-to-ground interface — gives the structure a level
  base, stops it settling, spreads the load.
- Three methods, in order of preference for a *removable* structure: post
  set in poured concrete (permanent), post on a poured concrete pier
  (permanent, costly), or **post on a pre-cast concrete block** sitting on
  a paver on gravel — the recommended method, since it can be lifted out
  with minimal digging if the ramp ever moves.
- Ground prep: dig a 406mm (16") round hole, 203–305mm (8"–12") deep;
  compact the soil; fill with 102–152mm (4"–6") of gravel, then the paver,
  then the block.
- Footings go under the deck ends only by default (not the whole
  structure), though more can be added if budget allows.
- Post-to-framing attachment depends on height: ramps ≤1.22m (4ft) notch
  the 89×89mm (4x4) post and bolt a 2x4 to it with two 12.7mm (1/2")
  carriage bolts; taller ramps run the post up and bolt it directly to the
  deck framing instead.
- Corners are set level first — stakes driven with ≥305mm (1ft) proud of
  the ground at all four corners, string run between them with a line
  level, before any digging starts.

### Assembly sequence

1. Draw and cut the transition template, trace the remaining ribs from it
2. Frame the transition sections (initial ribs, then the rest at ~203mm
   centers)
3. Frame the flat-bottom section
4. Clamp all sections together
5. Bolt or screw the sections together (six 63.5mm/2 1/2" screws per side
   if landing on concrete; four 12.7mm/1/2" bolts through 15.9mm/5/8"
   holes per side if landing on footings)
6. Attach coping
7. Skin the decks: 19mm ply, then 9.5mm ply
8. Skin the transitions: 9.5mm ply
9. Apply the masonite topsheet over everything

### Hardware list (this build's size only)

- 53 × 2x4, 2.44m (8ft) long
- 4 sheets 1.22m×2.44m (4x8ft), 19mm (3/4") plywood
- 10 sheets 1.22m×2.44m (4x8ft), 9.5mm (3/8") plywood
- 5 sheets 1.22m×2.44m (4x8ft), 6mm (1/4") masonite
- 1 steel pipe, 60mm OD × 4.88m (2 3/8" × 16ft), cut into two 2.44m pieces
- Two ~11.3kg (25lb) boxes of screws: 41mm (1 5/8") and 63.5mm (2 1/2")
- 8 hook bolts

### Safety/maintenance notes

- CDX-grade or better plywood only — particleboard is explicitly called
  out as unacceptable for any skate structure.
- Pressure-treated lumber needs care in handling/cutting — the
  preservative chemicals are a poison, not just a rot-resistance
  treatment.
- Pre-drill screw locations throughout to prevent splitting.
- Before skating a finished ramp: inspect the whole surface for any screw
  left proud of the surface.
