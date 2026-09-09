# DrugTrace AI

Field documentation for presumptive colorimetric drug tests. Photograph a reagent test before
and after the reaction next to a printed grey card; the app measures the colour under a known
lighting reference, compares it against your reagent registry, and files a hash-chained record
with GPS and timestamp.

Reagent colour tests are **presumptive**. This tool makes the documentation rigorous and the
colour reading repeatable. It does not identify substances.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Camera and GPS require **HTTPS or localhost**. Opening `http://192.168.x.x:3000` on a phone will
silently fail both — use a tunnel (`cloudflared`, `ngrok`) or run Vite with a local certificate.

Optional sync server, if you want records centralised as well as on-device:

```bash
npm run server       # http://localhost:8787
```

then set `VITE_API_BASE` in `.env.local` and restart Vite. Without it, records live in the
browser's IndexedDB and never leave the device — a complete, working setup on its own.

## First run

1. Print `public/reference-card.html` on matte paper at 100%, printer colour correction off.
2. Open **Reagents** and import your registry as JSON or CSV. It starts empty by design; the
   "Show expected format" button in the import dialog prints the schema.
3. On **Field test**, capture the before photo with the card in frame, apply the reagent, capture
   the after photo, then tap the grey patch and the reaction zone on each.

## Docs

- `context.md` — architecture, design decisions, verification done, what remains. Read this first.
- `public/reference-card.html` — printable card.
