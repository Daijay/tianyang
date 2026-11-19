# CRITIC

Scores are 1-10 and deliberately harsh ("fine" is a 5). Screenshots live in `shots/rN/`. Reference: `references/ref1.png` (pink blossom canopies, ornate gold ring-stud trim, hazy pale ruins, diagonal light shafts, teal spirit).

The harness renders with software GL, so absolute frame rates are not measured here; scores are about the picture.

## Round 1 (first renders, Low preset) 

| View | Lighting | Composition | Fusion | Color | Polish |
|---|---|---|---|---|---|
| arrival | 5 | 4 | 5 | 4 | 4 |
| blossom | 4 | 3 | 5 | 4 | 3 |
| pool | 5 | 5 | 6 | 5 | 4 |
| pyramid | 5 | 5 | 7 | 5 | 5 |
| top | 5 | 5 | 7 | 5 | 4 |
| reveal | 6 | 6 | 8 | 6 | 5 |

Concrete problems found:
- Camera field of view blew up to 60-120 degrees: the first frame had a negative time step, which made the damping overshoot. Fixed by clamping dt to [0, 0.05].
- Blossom canopies were enormous, flat hot-pink icospheres that swallowed the view. Shrunk blobs 40%, more of them, paler palette, lighter underside.
- Light was flat: violet fill and hemisphere dominated, the sun was too weak (surfaces went lilac-pink). Sun 3.7 -> 6.2, fill 0.85 -> 0.5, env 0.55 -> 0.32.
- Camera too close for a diorama. Distance 21 -> 37, pitch 0.74 -> 0.80.
- Title / reveal cameras were at ground level inside the tree canopy. Raised above the trees and backed off.
- Niche lantern halos on the pyramid were too many blown-out white dots. Halo strength roughly halved.
- Cliffs were saturated brick red. Desaturated toward ochre.

## Round 2 (Low preset, after fixes)

| View | Lighting | Composition | Fusion | Color | Polish |
|---|---|---|---|---|---|
| arrival | 6 | 5 | 6 | 6 | 5 |
| blossom | 7 | 6 | 7 | 7 | 6 |
| pool | 7 | 6 | 7 | 7 | 6 |
| pyramid | 7 | 6 | 8 | 7 | 6 |
| top | 6 | 6 | 8 | 7 | 5 |
| reveal | 8 | 8 | 9 | 8 | 7 |
| mobile | 6 | 5 | 6 | 6 | 5 |

Concrete problems found:
- Reveal: lovely, but the sun halo is milky and washes the upper third; the sky shows no blue-violet; ghost ruins are flat orange. -> lower halo, bloom 0.95 -> 0.7, god-ray weight down, deeper zenith.
- Arrival: huge flat salmon dune field, no structure. -> brighter, warmer dune colour, reduce violet hemisphere ground.
- Title camera still among trees. -> +18 higher.
- Occasional black rectangles in captures: partial software-GL frames, not a game bug. Harness now retries until the frame is complete.
- Ground mosaic edges are jaggy at Low (1024 px texture for 200 units). Medium/High use 2048/3072. -> verify on Medium.

(Later rounds are appended below as they are run.)

## Round 3 / 4 status (honest)

- Round 3 (Low) screenshots: reveal 8/8/9/8/7 (lighting/composition/fusion/color/polish). Gameplay views (arrival, blossom, pool, pyramid, top) are about 6-7: warm and readable, but the canopies still dominate the gameplay camera and dune fields are plain.
- Round 4 fixes were applied (warmer dunes, lighter blossom underside, softer bloom and god rays, higher title camera, harness retry for partial frames), but I could not re-score them: the software-GL harness cannot complete a Medium or High startup reliably (it loses the context or captures partial frames). A runtime switch Low -> Medium did render correctly (god rays, clouds, feathered-serpent kite visible).
- **The brief's bar (every view 8+) was NOT verified.** Only the reveal view reaches it. Real-GPU frame rates were not measured either.
