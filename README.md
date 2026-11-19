# TIANYANG 天阳

A short, calm 3D exploration game. You arrive at a sun-drenched temple city on a desert plateau, a single civilization that blends Chinese, Japanese and Mayan architecture, and walk up to a pyramid-pagoda as the golden-hour sun sets behind it. No combat, no puzzles, no fail state.

Everything (geometry, textures, particles, shaders, audio) is generated in code. No models, images or sound files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Build a static bundle for Vercel / Netlify / GitHub Pages / any static host:

```bash
npm run build      # outputs dist/
npm run preview    # test the production build
```

On Vercel: import the repo, framework preset "Vite", build command `npm run build`, output directory `dist`. No server needed.

## Controls

| Input | Move | Run | Rest |
|---|---|---|---|
| Keyboard | WASD / arrows | Shift | Space |
| Gamepad | Left stick (push fully to run) | B / right trigger | A |
| Touch | Virtual joystick appears under your left thumb | push the stick to the edge | the button on the right |

Resting sits the traveler down and slowly orbits the camera, good for screenshots. Walk to the glowing sun mosaic at the top of the pyramid stairs for the final reveal.

Settings (cog, top right): Quality Low / Medium / High, and Hide UI. The mute button is next to it. Quality is auto-picked (mobile gets Medium or Low, pixel ratio capped at 1.5) and drops one tier automatically if the frame rate stays low. Add `?q=low|medium|high` to the URL to force a tier.

## Project layout

```
src/
  main.js        boot, game loop, quality switching, test hooks (window.__ty)
  config.js      palette, sun direction, quality presets, shared haze GLSL
  render.js      WebGL2 renderer + postprocessing stack (bloom, god rays, ACES, grade, vignette, grain)
  fog.js         world-space height fog that replaces three's fog chunks
  sky.js         gradient sky shader, sun disc, clouds, environment map
  world.js       layout constants, height field, collision, ground classification
  terrain.js     dune terrain mesh + procedural ground texture painter
  buildings.js   parametric builders: hip roofs, pagoda, pyramid, torii, stairs, pavilion, walls, pools
  motifs.js      fret, cloud scroll, sun disc, glyph bands, lanterns
  decor.js       cherry trees, bushes, grass, petal carpets, banners, hanging lanterns, glow halos
  level.js       places everything
  water.js       water shader, koi
  particles.js   petals, dust motes, sand wisps, light shafts
  creatures.js   qilin, stone turtle, fox spirit, feathered serpent kite, birds
  player.js      procedural traveler with straw hat and trailing scarf
  camera.js      follow / rest-orbit / reveal / title / intro camera
  input.js       keyboard, gamepad, touch joystick
  audio.js       Web Audio: wind, pad, chimes, water, footsteps
  ui.js          title screen, settings, mute
tools/           Playwright screenshot harness used for the critic loop
```

## Screenshot / critic harness

```bash
npx playwright install chromium
tools/run.sh r1 q=medium          # writes shots/r1/*.png and console.txt
```

See `CRITIC.md` for the scored review rounds and `DECISIONS.md` for creative and technical decisions.
