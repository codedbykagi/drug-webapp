# DrugTrace AI — project context

Written for whoever picks this up next, human or AI. Read this before changing anything.

**Project:** `drugtraceai`, a Smart India Hackathon 2026 entry for the "Digital Companion for
Field Drug Testing" problem statement (PS 26231).

**What it is:** a phone-first web app that documents presumptive colorimetric drug tests. An
officer photographs a reagent test before and after the reaction, the app measures the colour
under a known lighting reference, compares it against a registry of reagent reference colours,
and files a tamper-evident record with GPS and timestamp attached.

**Jurisdiction:** none. The tool is built for use in India but implements no country's rules,
forms, evidence standards or statutes, and names none. It records what was measured, by whom,
where and when; how that maps onto a legal process is a deployment question, not a code question.
Do not add references to specific acts, sections, form numbers or admissibility standards — an
earlier draft carried US ones and they were wrong in substance as well as geography.

**What it is not:** a device that identifies drugs. Reagent colour tests are *presumptive*. They
have real false-positive rates and are not admissible as a positive identification. The app
exists to make the documentation rigorous and the colour reading repeatable, not to replace a
lab. Anything in the code or copy that implies otherwise is a bug.

---

## Stack

React 19 + TypeScript + Vite 6 + Tailwind v4. Icons from `lucide-react`. No state library, no
router — three screens switched by a `currentView` string in `App.tsx`.

Originally scaffolded in Google AI Studio, which is why `metadata.json` and the AI Studio
comments in `vite.config.ts` exist. They are harmless.

```
npm install
npm run dev       # http://localhost:3000
npm run lint      # tsc --noEmit
npm run server    # optional sync server on :8787
```

**Camera and GPS need HTTPS or localhost.** Testing on a phone over `http://192.168.x.x:3000`
will silently fail both. Use a tunnel, or `vite --https` with a local cert.

---

## Architecture

```
src/
  lib/            pure logic, no React, individually testable
    color.ts        sRGB <-> Lab, CIEDE2000, von Kries white balance, patch sampling
    calibration.ts  the "light tool": reference-patch reading, quality gate, 3x3 matrix fit
    imaging.ts      blob <-> ImageData, EXIF-correct decode, downscale, JPEG encode
    shots.ts        shot lifecycle: create, place sample points, re-measure
    reagents.ts     registry JSON/CSV import + validation, colour matching
    assistant.ts    offline retrieval over the registry — no model, no network
    integrity.ts    SHA-256 hash chain over metadata AND photo bytes
    geo.ts          geolocation with real error handling
    db.ts           Store interface; LocalStore (IndexedDB) and RemoteStore (HTTP)
  hooks/
    useCamera.ts    getUserMedia, torch, lens switch, exposure/WB lock, cleanup
  components/
    AssistantPanel.tsx             slide-over Q&A over the registry
    capture/SpecimenViewport.tsx   camera + upload + tappable sample markers
    CaseLog.tsx                    filed records, chain verification, thumbnails
    screens/                       the three pages
    modals/                        calibration, import, add reagent, custody report
server/index.js   Express + node:sqlite, append-only record store
public/reference-card.html  printable grey/colour card — the physical half of the light tool
```

The `lib/` layer is deliberately React-free so it can be tested with plain Node. It has been.

---

## The three screens

1. **Field test** (`intake`) — the main page. Two capture slots, the metadata form, the result
   panel, and the case log underneath.
2. **Reagents registry** (`registry`) — reference colours. **Starts empty on purpose.**
3. **How to use** (`ops`) — untouched by design; the owner asked for it to be left alone.

---

## How the colour measurement actually works

This is the core of the project. Read this section before touching `color.ts` or `calibration.ts`.

### The problem

The same reagent pouch photographed under tungsten light, daylight and a supermarket LED gives
three different RGB values. Two different phone models under the *same* light also disagree,
because their sensors have different spectral responses and their auto-white-balance makes
different guesses. Comparing raw RGB across photos is meaningless.

### The solution used here

Put a surface of **known reflectance** in the frame and measure the light instead of guessing it.

1. Officer photographs the sample with a grey card (or plain paper) beside it.
2. Officer taps the card in the photo. The app samples that patch.
3. Because we know the patch is neutral, whatever colour it *actually* recorded tells us the
   cast the light imposed.
4. Von Kries diagonal gains are computed to make that patch neutral again, and the same gains
   are applied to the reaction-zone reading.
5. The corrected reading is converted to CIE Lab and compared against registry colours using
   CIEDE2000.

Two photos, not one, because comparing before against after tells you whether the reagent did
anything at all. If the before/after ΔE is under `NO_REACTION_THRESHOLD` (4), nothing happened
and the result is negative regardless of what the absolute colour looks like.

### Non-obvious implementation decisions

Each of these is a bug if reverted. They are commented in the source too.

- **White balance is applied in linear light, not gamma-encoded sRGB.** Scaling gamma-encoded
  channels is the common shortcut and it skews hue as soon as the correction exceeds a few
  percent — which is exactly the tungsten-vs-daylight range we care about.
- **Patch sampling uses a median, not a mean.** Reagent pouches are glossy. A sample window
  almost always catches a specular highlight, and a mean drags the reading toward white.
- **CIEDE2000, not Euclidean Lab distance.** Plain Euclidean under-weights lightness differences
  at the dark end, which is where most reactions land (Marquis going near-black, Scott going
  deep cobalt).
- **`applyGainsToImage` builds a 256-entry LUT per channel.** Calling `pow()` twice per subpixel
  on a 12 MP photo is ~70 million calls and freezes the main thread.
- **`createImageBitmap(..., { imageOrientation: 'from-image' })`.** Without it, photos from most
  Android cameras arrive rotated and every tapped sample coordinate is wrong.
- **JPEG quality 0.92, not the usual 0.8.** Chroma subsampling is the enemy; quality keeps the
  reaction colour honest.
- **Exposure and white balance are locked before the first capture** where the browser exposes
  the constraint. If auto-WB runs between the two shots, the phone invents a colour difference
  that was never in the pouch. Safari usually does not expose it, which is precisely why the
  in-frame reference patch is not optional.
- **Quality score and usability are separate.** A clipped or crushed patch carries no recoverable
  information however clean it otherwise looks, so those are hard disqualifiers, not score
  deductions. A run of small penalties must never sum to "acceptable" for a physically unreadable
  reference. (This was a real bug during development: clipped white scored exactly at the
  threshold and passed.)

### Verification already done

- Assistant: 9 typo variants matched correctly, 6 absent substances correctly refused.
- `deltaE2000` matches **all 34 pairs** of the Sharma, Wu & Dalal (2005) CIEDE2000 verification
  dataset. Worst error 4.95e-5.
- `rgbToLab` matches published values for sRGB white, mid-grey and pure red.
- Lab round trip within 1/255 across six colours.
- Median sampling verified to ignore 12 blown-out pixels in a 100-pixel window.
- `fitColourMatrix` recovers a known camera crosstalk matrix from 6 patches; rejects degenerate
  all-neutral input and fewer than 4 patches.
- Quality gate verified across 8 realistic lighting cases.
- Server multipart parser verified against binary payloads containing CRLF and `--` bytes.
- SQLite schema, chain walk, tamper detection and cascade delete verified.

**If you change the colour maths, re-run those checks.** They are not currently committed as a
test suite — see "Not built".

---

## Storage

`src/lib/db.ts` defines a `Store` interface with two implementations.

- **`LocalStore`** — IndexedDB. The default, and not a placeholder. Offline-first is the correct
  architecture when the user is at a checkpost with one bar of signal. Survives refresh, close
  and reboot. `requestDurableStorage()` asks the browser to exempt the origin from eviction;
  without it Safari bins the data after 7 days of no visits.
- **`RemoteStore`** — HTTP to `server/`. Enabled by setting `VITE_API_BASE`. It **always writes
  locally first**, then pushes, so a mid-save network drop cannot lose a record.

Photos are stored as **`Blob`, not base64 data URLs**. Base64 is 33% larger and IndexedDB handles
Blobs natively. This matters at a few hundred cases.

### The server

`server/index.js`, Express + `node:sqlite` (built into Node 22, no native module to compile).
Append-only: re-sending a record already held is a successful no-op rather than an overwrite,
which is what makes retrying a failed sync safe. `GET /api/verify` re-walks the chain and
re-hashes photo files on disk.

The multipart parser is hand-rolled because pulling in `multer` for two field names is not worth
the dependency. It is ~40 lines and tested.

**CORS is wide open** (`*` by default). Fine for a demo, lock it before anything real.

### Tamper evidence

`integrity.ts` hashes each record over its canonical metadata **plus the raw bytes of every
photo**, and folds the previous record's hash into the next. Change one pixel of an old photo and
every hash after it stops matching. That is a ten-second stage demo.

The canonical string is built by hand with an explicit field order — `JSON.stringify` key order
is not guaranteed stable enough to hash against.

This is **integrity, not authenticity**. It proves the file has not been edited since it was
written. It does *not* prove who wrote it. For that you need a signing key the officer cannot
reach, which is a server-side problem and is not built.

---

## Two design questions the owner asked, and the answers given

### "Should I train an AI for colour constancy?" — No.

The idea was: since drugs can't be obtained and photographed thousands of times, train a model on
t-shirts or objects under varying light to learn illumination invariance instead.

It is a real research area (learned illuminant estimation — FC4, Cheng et al.). It was rejected
because:

- It solves a problem a grey card solves **exactly**. Learned colour constancy lands around 2–4°
  angular error; a reference patch is near-exact because it *measures* the light rather than
  estimating it.
- The forensic argument is decisive. "There was a calibrated grey patch in the photograph"
  survives cross-examination. "A neural network estimated the illuminant" does not.
- Data collection is a large time sink for a hackathon with no payoff over the card.

**Do not reintroduce this.** The reference card plus registry lookup is the design.

### "How do I train an LLM on the reagent data?" — Don't fine-tune. Retrieve.

**Built.** See `src/lib/assistant.ts` and `src/components/AssistantPanel.tsx`.

There is no language model in this project, and that is the design rather than a shortcut. The
useful work in a retrieval-augmented system is the retrieval; a model only rephrases what
retrieval already found. Since every answer the assistant can give is a fact copied out of a
registry entry, the phrasing is a template — and the result runs on a weak phone in aeroplane
mode, answers in under a millisecond, and cannot invent a colour nobody measured.

It answers five intents, detected from the query:

| Intent | Example | Mechanism |
|---|---|---|
| `analyte` | "how do I test for heroin" | fuzzy match against analyte names |
| `reagent` | "tell me about Marquis" | fuzzy match against reagent names |
| `colour` | "what turns purple" | **ΔE2000 distance in Lab space** against every reference colour — the same maths the photo matcher uses |
| `expiry` | "anything expired?" | date arithmetic over the registry |
| `overview` | "what do we have loaded?" | counts and coverage |

Unmatched queries fall back to keyword scoring, and failing that return `unknown` with an
explicit statement that it will not guess, plus a list of what *is* loaded.

**The critical safety property, and the thing most likely to be broken by a careless edit:**

Fuzzy matching alone is not safe for drug names. "ketamine" and "methamphetamine" share six
trigrams and scored just over a naive 0.45 threshold — so an early version answered a question
about ketamine with a methamphetamine entry. Confidently wrong, about a substance that was not
even loaded. That is precisely the failure this whole architecture exists to prevent.

The fix: a fuzzy hit must *also* look like the same word — either the query token appears inside
the candidate, or the two share a prefix of at least three characters. Genuine typos keep their
prefix; unrelated drugs that merely rhyme do not. **Do not remove that guard.** Verified:

- Matches: `methamphetemine`, `marquee`, `markwis`, `scot reagent`, `herion`, `heroine`, `cocain`, `meth`, `mdma`
- Correctly refuses: `ketamine`, `fentanyl`, `lsd`, `psilocybin`, `mescaline`, `codeine`

Reached from the sidebar ("Ask the registry") and from a floating button below the `lg`
breakpoint, since the sidebar is hidden on phones.

If someone later wants an actual LLM on top, keep this layer as the base and let the model
phrase its output. Retrieval must stay the source of every fact, and the offline path must keep
working — venue wifi dies.

---

## Things deliberately removed, and why

The AI Studio scaffold was a visual mock with nothing behind it. Removed:

| Removed | Why |
|---|---|
| Hardcoded GPS (Las Vegas coordinates) | Replaced with real geolocation |
| Hardcoded SHA-256 string | Replaced with a real hash chain |
| `"99.4% confidence"` | A colour distance is not a probability. Presenting it as one is how a defence lawyer dismantles the tool. Replaced with ΔE plus a plain-language label ("Very close", "Approximate", "No match") |
| `DEA_SPEC_8_KIT`, `SYNTHETIC_OPIOID_MATRIX`, `UNODC_FIELD_PANEL` seed data | Reference colours are evidence. Shipping invented ones means a reading could be "matched" against a number nobody measured. `src/data/mockData.ts` is now intentionally empty |
| Fake progress bars ("SLOT A 35%") | Now derived from real registry counts |
| Calibration sliders that set a number and did nothing | Now a real camera-based reference reading |
| `@google/genai`, `motion` | Unused. The assistant is pure retrieval and needs no API key |
| All CJIS branding | CJIS is a US FBI system; this is an Indian problem statement. `TestRecord.cjisRef` renamed to `caseRef`; "Form CJIS-882" and "CJIS Level 4" strings removed |
| "Admissible under Federal Rule of Evidence 901 & Daubert-Frye" | US legal standards, and an overclaim in any jurisdiction for a presumptive test. Replaced with a statement that lab confirmation is required |
| Page 3's automatic cloud sync, "Hardware UTC Clock Verification", Daubert/Frye cards | Described features that do not exist. Page 3 was fully rewritten against what the app actually does |
| Sidebar claims of "AES-256-GCM / CJIS" encryption | Not true. Now reads "on-device (IndexedDB)" and "SHA-256 hash chain", which is what actually happens |
| Hardcoded "14ms" latency readout | The app makes no network calls by default. Replaced with whether a lighting reference is loaded, which is real and useful |
| "SWGDRUG Category C", "Optical Forensic Core", "Partition 0X4A", "formulary", "spectrogram count", "SLOT-07", "λ = 0 nm" | Invented technical vocabulary. It reads as machine-written because it is: impressive-sounding terms attached to nothing. Replaced with what each thing actually is, or deleted |
| 39 label-only JSX comments | `{/* Step 1 */}`, `{/* Card 2: ... */}` and similar restated the line beneath them. Two even read `Exact match to Image 3` — the generation prompt leaking into source |
| `spectrogramCount` field | Renamed `colourStateCount`, which is what it counts |
| Hardcoded officer stamp ("Inv. S. Miller, CSU Unit 4") | Officer details belong to each record, not the chrome |

### Resolved

Both of the previously open issues are closed. CJIS branding is gone from the entire codebase —
verify with `grep -ri cjis src/`, which should return nothing. Page 3 was rewritten from scratch
against actual behaviour: six real steps, six benefits that describe implemented features, and
six FAQs covering the questions the app genuinely raises (no card to hand, where data goes, what
ΔE means, why two photos, why camera needs https).

**The standing rule this came from:** if the UI claims it, the code must do it. Every claim on
page 3 now maps to something in `src/`. Do not add aspirational copy.

---

## Not built

Roughly in the order that would add most value:

1. **A committed test suite.** All the verification above was run ad hoc during development and
   is not in the repo. Port the Sharma dataset check, the quality-gate cases, the matrix fit and
   the multipart parser tests into Vitest. This is the highest-value remaining task — the colour
   maths is the thing most likely to be broken silently.
2. **Multi-patch matrix calibration wired into the UI.** `fitColourMatrix` exists and is tested;
   Card B in `public/reference-card.html` is printed for it; nothing calls it yet. Needs a UI for
   locating 8 patches in a frame.
3. **Automatic reference-card detection.** Officers currently tap the patch by hand. Detecting
   the printed card automatically would remove the main source of user error. Classical CV
   (contour finding on the card border) is enough; no ML needed.
4. **Signing keys** for authenticity, as distinct from the integrity already implemented.
5. **PWA / service worker** so the app installs to the home screen and opens offline. The data
   layer is already offline-capable; only the shell is missing.
6. **Reagent expiry warnings surfaced on the field test screen.** The assistant answers
   "anything expired?" but the field test screen still does not warn at the point of use. The registry screen already
   computes them. An expired reagent produces the *wrong* colour, not no colour, so this matters
   more than it sounds.
7. **Export a case bundle** (record JSON + photos + hash) as a zip for handing to a lab.

---

## Conventions

- `lib/` stays React-free.
- Comments explain *why*, not *what*. If a line looks wrong but is deliberate, it has a comment
  saying so. Do not strip those. Conversely, do not add comments that restate the code — a
  sweep removed 39 of them and they should not come back.
- **No invented vocabulary.** If a label does not name a real thing in the system, it does not
  go in the UI. "Reference colours" over "spectral matrix"; "Loaded reagents" over "active
  formulary catalog". Impressive-sounding nouns attached to nothing are the clearest sign a
  machine wrote the copy, and judges read the screen before they read the code.
- **No jurisdiction.** No acts, sections, form numbers, agencies or admissibility standards.
- **No fabricated telemetry.** No latency figures, confidence percentages, or status readouts
  that are not measured. If it is not computed, it is not displayed.
- No fabricated numbers anywhere in the UI. If a value is not measured, show "Not measured" or
  "—", never a plausible-looking placeholder. This is the single most important convention in the
  project.
- The design is the owner's and predates this work. Add functionality; do not restyle. Glass
  panel styles live in `src/index.css` (`.glass-panel`, `.glass-input`, `.grid-mesh`).
