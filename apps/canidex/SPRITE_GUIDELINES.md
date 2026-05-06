# Canidex Sprite Guidelines

Use this file as the project-side source of truth for future Canidex breed sprites.

Automation lives in:

- [prepare_sprites.py](/Users/mason/Documents/mgcom/apps/canidex/scripts/prepare_sprites.py)

Use it for:

- single-source sprite cleanup and normalization
- sheet component extraction into normalized breed assets

## What We Learned

The main failures were not just art-style issues. The real production risks were:

- inconsistent chroma cleanup
- wrong crop windows from source sheets
- transparent PNGs carrying contaminated RGB in alpha-0 pixels
- different effective sprite sizes because files had different alpha bounds and padding

Future batches should be treated like a small asset pipeline, not just image generation.

## House Style

- Nintendo DS-era inspired dog sprite
- `3/4` pose
- dog only, no props or scenery
- breed-accurate silhouette first
- one notch less realistic than semi-realistic illustration
- simplified rendering, not cute/chibi
- limited palette and readable shading

## Source Generation Rules

- Generate on a perfectly flat hot pink `#ff00aa` background.
- Avoid white chroma backgrounds because many dogs have white coats or highlights.
- Prefer poses with fewer enclosed gaps between limbs when possible.
- Keep the dog centered and consistently scaled in a square source image.
- Do not allow tails, ears, or coats to touch the frame edge.

## Sheet Rules

If generating multiple dogs on one sheet:

- each sprite must be clearly isolated from the others
- leave enough empty background between breeds for connected-component extraction
- do not assume a naive fixed crop grid will be safe
- map extracted sprites by actual detected component order, not guessed crop windows

## Cleanup Rules

When turning a source image into a production asset:

1. Remove the flat hot pink background.
2. Remove magenta fringe, not just exact `#ff00aa` pixels.
3. Zero RGB data in fully transparent pixels.
4. Crop to the true alpha bounds.
5. Never leave arbitrary transparent padding around some breeds but not others.

Important:

- exact-magenta-only removal is usually not enough
- near-magenta antialiasing can still show as haloing in-browser
- transparent pixels with nonzero RGB can still bleed during browser scaling

## Final Asset Normalization

All active Canidex dog sprites should be normalized the same way before use.

Current production rule:

- final file format: transparent PNG
- final canvas: `256x256`
- target maximum sprite footprint: about `214px` on the longest dimension
- center the sprite within the canvas

This keeps:

- old and new breeds visually consistent
- roster cards from making some dogs look huge and others tiny
- reward and detail views aligned with the same rendering assumptions

## App Rendering Assumption

The app currently renders breed assets inside framed containers using `object-fit: contain`.

That means sprite scale is heavily affected by:

- alpha bounds
- transparent padding
- final canvas normalization

If those are inconsistent, the UI will look broken even when the art itself is fine.

## QA Checklist

Before wiring a new breed into the dex, verify:

- no visible magenta remains
- no magenta-like fringe remains on edges
- no contaminated RGB remains in alpha-0 pixels
- the breed is correctly mapped from the source sheet
- the full silhouette is present with no cut-off ears, tails, heads, or feet
- no parts of neighboring breeds leaked into the crop
- the sprite matches the current normalized size system
- the breed looks consistent beside `#001 Golden Retriever` and a recent sheet-derived breed

## Practical Recommendation

For approval rounds, batch generation is fine.

For final production:

- generate or extract carefully
- clean the alpha correctly
- normalize to the shared canvas
- inspect in the actual Canidex roster before considering the asset done

## Script Usage

Normalize one or more source PNGs into production-ready transparent assets:

```bash
python3 apps/canidex/scripts/prepare_sprites.py normalize \
  apps/canidex/assets/golden-retriever-001-source.png \
  --output-dir apps/canidex/assets
```

Extract a sheet using a JSON array of output filenames in component order:

```bash
python3 apps/canidex/scripts/prepare_sprites.py extract-sheet \
  --sheet apps/canidex/assets/sheets/canidex-sheet-01.png \
  --mapping /tmp/canidex-sheet-01-map.json \
  --output-dir apps/canidex/assets
```

The script applies the current production pipeline:

- chroma cleanup using hot pink defaults
- magenta fringe removal
- transparent-pixel RGB cleanup
- tight alpha crop
- final normalization to `256x256` with a `214px` target footprint
