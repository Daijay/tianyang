# DECISIONS

Creative and technical calls made while building TIANYANG (no questions asked, per the brief).

## Creative

- **Sun to the north, low, slightly east.** The sun sits about 15 degrees above the horizon behind the pyramid when you approach. Surfaces facing the camera are mostly in shade (blue-violet), edges and tops catch gold. This is the Monument Valley / Journey look: warm vs cool contrast comes from the light direction, not from textures.
- **A fill light tinted violet** with no shadows replaces the missing bounce light on the shaded faces so they stay readable but cool.
- **One civilization, not three zones.** Every structure repeats the same fused vocabulary: Mayan stepped terraces and step-fret (greca) friezes, Chinese turquoise-glazed upturned hip roofs with brackets (dougong) and cloud-scroll curls, Japanese vermilion torii pillars with a black kasagi top beam. The sun disc is the shared symbol (torii top beam, pagoda finial, lanterns, banners, floor mosaics, pyramid niches).
- **Reference image.** The supplied screenshot is a pixel-art metroidvania with pink blossom canopies, ornate gold trim bands made of repeated ring studs, hazy pale ruins in the background, diagonal light shafts and a teal spirit. I took: the gold ring-stud trim (path edges, terrace edges, pool rims, plaza border), the pale layered ghost ruins in haze, round green bushes, diagonal god-ray shafts, and the teal spirit flame (floating above the fox spirit).
- **Route and length.** The main route is an S-shaped loop of about 300 units (arrival stairs, blossom avenue, canal bridge, west garden, pool plaza, east garden, pyramid stairs). At walking speed 2.9 u/s that is roughly two minutes of pure walking, three to four with lingering, the idle zoom, the rest orbit and side detours.
- **Final reveal.** A gold sun mosaic marks the top of the stairs. Standing on it for a moment pulls the camera back and around to the south-west so the pyramid-pagoda is framed against the sun, with the pagoda finial (crossed sun discs) overlapping the sun. Leaving the platform returns to the normal camera.
- **Creatures** (all original): a qilin-like deer with turquoise-jade flame mane and gold horns, a stone turtle with a carved gold-ringed shell, a three-tailed fox spirit with a teal flame, and a feathered-serpent kite that loops around the pyramid in the sky. Birds circle the pagoda; koi swim in every water body.

## Technical

- **Stack:** Vite, three 0.187, postprocessing 6.39, plain ES modules. WebGL2 only.
- **Everything procedural.** Architecture is built with a `Builder` that bakes primitives into merged, vertex-colored geometry, bucketed by material (main / gold / glow) and by 44-unit spatial chunk so frustum culling still works. Three shared materials cover the whole level.
- **Ground** is a painted canvas texture in world units (paths, flagstones, sun mosaics, plaza fret band, ring studs). It is sampled by the terrain shader from world position.
- **Fog.** Three's fog shader chunks are replaced with a world-space height fog tinted by the sun and matched exactly to the sky horizon, so distant ruins and dunes melt into layered silhouettes.
- **Bloom is selective by threshold.** The pipeline is HDR (half float). Only emissive materials (lanterns, sun discs, gold glints in direct sun) are pushed above 1.0, and bloom thresholds at 1.0.
- **Shadows.** One directional light, PCF shadow map following the player, snapped to texel increments so shadows never shimmer. (three 0.187 removed `PCFSoftShadowMap`; `PCFShadowMap` is the soft one now.)
- **God rays.** pmndrs `GodRaysEffect` on the sun mesh (when the sun is on screen) plus additive light-shaft cards aligned to the sun direction (visible from any camera angle) plus sun-aligned dust motes.
- **Camera occlusion.** Canopies, gates and roofs dither away in a cone between camera and player so the traveler is never hidden by blossoms.
- **Movement and collision.** A height-field plus colliders: the walkable height function is analytic (stairs, bridge, pyramid terraces); a step may rise at most 0.75 and drop at most 1.3, so cliffs, terrace walls and water are blocked automatically. Circles and oriented boxes handle pillars, trunks, walls and buildings. Stairs are quantized to match the visible steps and the traveler's visual height is smoothed.
- **Quality tiers.** Low: 1x DPR, 1024 shadow map, FXAA, no god rays / clouds / heat shimmer, 1.4k petals. Medium: up to 1.25x, 2048 shadows, MSAA 2. High: up to 2x, 4096 shadows, MSAA 4, 9k petals. Mobile is capped at 1.5x DPR and starts on Medium or Low (by core count / memory). The game also steps down a tier by itself if the frame rate stays low.
- **Audio** is pure Web Audio: filtered-noise wind, a pentatonic triangle/sine pad through a generated convolution reverb, bell chimes whose rate and volume follow distance to the nearest lantern, a water bed that follows distance to water, footsteps that differ on sand and stone. It starts on first input and has a mute toggle.
- **Test hooks.** `window.__ty` exposes teleport, camera and stepping hooks used by `tools/shots.mjs` for deterministic screenshots. Query flags: `q=low|medium|high`, `noauto` (disable adaptive quality), `msaa=N`.
- **Headless rendering limits.** The harness renders with software GL (SwiftShader), which is slow and loses the context at the High preset, so the critic loop was run on the Low and Medium presets. High is verified for startup only.
