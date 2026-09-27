# TCG Seller Vault — Show Repurposer

Mobile-first prototype that turns a stream recording into a branded social clip. Analysis runs in the browser: it selects the sharpest frames from each reveal, prioritizes stable stream and clip labels, isolates full-card visual candidates, and combines OCR with TCGplayer catalog-image comparison. Matches use the daily TCGCSV/TCGplayer catalog spanning every available TCG category, are consolidated into distinct reveals, and are filtered by finish-specific market values after recognition completes.

## Safety rules

- Unknown finish never defaults to non-foil.
- A value is rendered only after card, set/printing, finish, and finish-specific market record pass verification.
- Uncertain matches must be confirmed or skipped.
- Visual aids start on the first confidently readable full-card frame, end before the next card reveal, last 1.6 seconds for $1.00–$9.99 cards, and up to 3.6 seconds for $10+ cards.

## Run locally

```sh
TCG_CATEGORY_IDS=77 npm run catalog
npm run serve
```

Omit `TCG_CATEGORY_IDS` to build all categories. GitHub Actions does this daily and deploys the resulting static app to GitHub Pages.
