# TCG Seller Vault — Show Repurposer

Mobile-first prototype that turns a Whatnot recording into a branded social clip. Analysis runs in the browser: sampled frames are OCR'd, matched against a daily TCGCSV/TCGplayer catalog spanning every available TCG category, checked for multi-frame foil evidence, and placed into a review queue whenever confidence is insufficient.

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
