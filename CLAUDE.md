# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install deps (Node `^22.18.0 || >=24.12.0`)
- `npm run dev` — Vite dev server with HMR (includes vue-devtools plugin). UI kit gallery (dev only) at `/?kit`
- `npm run build` / `npm run preview` — production build / serve it

There is no test runner or linter configured yet (SPEC §10 plans Vitest for `palette.js`).

## Architecture

ColorScrap is a Vue 3 + Vite + Tailwind 3 (PostCSS) app, a university AI final project: a watercolour mood sketchbook. **`docs/SPEC.md` is the source of truth** (read it before building a screen); reference mockups are in `docs/design/screens/` and `docs/design/style-board.html`. Plain JavaScript only (no TypeScript), `<script setup>`. UI text is in Thai, and so are code comments — keep that convention. `@` aliases `src/` (vite.config.js, jsconfig.json).

- **Single "desk", no router.** The whole app is one fixed 1280×800 stage (`components/desk/Stage.vue`) scaled to fit the window. The current screen is `view` in the Pinia store `stores/app.js` (`hello | cover | pick | paint | saved | book | photo`); transitions go through `go()` which enforces the table in SPEC §4.1. Persistent objects (`Scrapbook`, `DrawingBoard`, `EmotionPalette`) are never unmounted — they move/fade by `view`. Sync `view` with `location.hash` for the back button; do not add Vue Router.
- **Design tokens live in `src/lib/tokens.js` only** (plain data, no Vue imports). `tailwind.config.js` imports it, so use utilities (`bg-desk`, `text-ink-soft`, `bg-e-calm`, `font-hand`, `rounded-hand`, `ease-desk`) and never hard-code hex in components. Only runtime-changeable values (`--cover`, `--cover-spine`, `--cover-strap`) are CSS variables in `styles/tokens.css`. Cover spine/strap use plain RGB `mixRgb` (`lib/color.js`); `mixColors` (SPEC §8, HSL) is only for the daily palette.
- `components/ui/` is the kit (`HandButton`, `Tape`, `Polaroid`, `EmotionBlob`, `Doodle`, `WatercolorBlob`, `ColorStrip`). SVG paths for faces, avatars, icons and blobs are in `lib/emotions.js` / `lib/doodles.js`.
- `src/KitGallery.vue` renders every kit component; it is lazy-loaded by `App.vue` only when `import.meta.env.DEV` and the URL has `?kit`.

## Gotchas

- SVG filters (`wob`, `wc`, `wcm`, `wct`, `wcs`, `grain`) are defined once in `SvgDefs.vue` and used as `filter-wob` etc. Never put `wob` on large areas, things that animate constantly, or long text (put it on a frame element, as `HandButton` does) — iPad Safari performance.
- Keep the fluid instance in a plain `let`, never `ref()`/`reactive()`: Vue proxies interfere with WebGL. `paint/FluidCanvas.vue` wraps `webgl-fluid-enhanced` v0.8 (kept for step 5a; patching its display shader with patch-package or porting PavelDoGreat's simulation is the optional 5b, decided after seeing 5a). Its public API is `start/stop/setConfig/multipleSplats/splatAtLocation` only, so FluidCanvas works around it:
  - Pointers: the library's own mouse/touch handling is bypassed (touch uses `pageX`, wrong under the scaled Stage). A transparent overlay div takes Pointer Events and calls `splatAtLocation` (smear = hex `"#000000"`; drop = no hex). `splatAtLocation` x is device px (×dpr), y is CSS px.
  - Never pass a real hex to `splatAtLocation`/`colorPalette` expecting exact colour: the library uses only its hue/saturation, takes V from `brightness`, and multiplies by 1.5. `lib/dye.js` converts a target colour into `{ palette hex, brightness }`; `colorful` must stay `true` or `colorPalette` is ignored.
  - Subtractive look: canvas is opaque with `inverted: true` (CSS `invert(1)`) and `backgroundColor = invertedHex(paper)`, so dye = 1 − colour. Anything reading the canvas (`capture()`) must undo the invert (done with `difference` against white). Per-emotion `brightness` in `FLUID_PARAMS` (`lib/emotions.js`) is the dye strength tuned so colours match `EMOTION_COLORS`; measure with extractColors, don't guess.
  - Clear = set dissipation ~1000 for 8 frames (no public clear, and recreating the instance leaks FBOs). Paint never fades (`DENSITY_DISSIPATION` 0.002, same for all emotions); emotions differ by `curl`/`velDiss`. Because it never fades, `takeInk` (`INK_CELL`/`INK_CAP`) caps repeated drops per 80px cell so colour can't pile up to black.
  - Capture must run inside `requestAnimationFrame` (no `preserveDrawingBuffer`).
- Negative-mood shift (SPEC §6.4) lives in `FluidCanvas.vue` (`shiftTick`, per-sheet `shift` state, reset in `clear()`); it emits `shifted` → `app.sheetShifted` → `entry.shifted` on save. Dev only: open with `?shiftSpeed=10` to speed up its timing. `VITE_USE_MOCK=false` (`.env` / `.env.production`) drops the mock entries.
- Colours of a saved painting are extracted with the **npm** `colorthief` v3 (`getPaletteSync`, returns Color objects with `.hex()`), not the old v2 CDN `window.ColorThief` — that script tag is gone. Entries store `colors: [{ hex, ratio }]` (SPEC §6.6, §7.2).
- `lib/palette.js`: `mixColors` and `nameOfDay` are temporary stand-ins (RGB average / hue group + period) until step 8; `dominantColorOfDay`, `colorWeightsOfDay`, `timelineX`, `chunk` are real.
- `HandButton` has its own `relative`, so don't put `absolute`/`fixed` on it directly — wrap it in a positioned div.
- Open book (`book/OpenBook.vue`) is rendered by `Scrapbook.vue` for both `book` (1:1) and `saved` (scale 1.15, left page zoom); the closed cover layer is separate. `DrawingBoard.vue` stays mounted: full screen in `paint`, a 92px strip in `book`, hidden otherwise.
- Saving: `app.saveToBook()` is async (captures the canvas via the painter registered by `DrawingBoard`, runs `lib/extractColors.js`, encodes WebP via `lib/exportImage.js`); entries carry `image`/`thumb` Blobs (markRaw) and are persisted in IndexedDB (`lib/imageStore.js`) until Supabase (step 7); components make object URLs with `useBlobUrl` (auto-revoke). Mock entries have no blobs and keep the fake blob drawing. "เริ่มใหม่" needs a second tap within 3s (SPEC §5.3), there is no undo/toast.
- Mock data (steps 3–4) must use the same entry shape as the Supabase schema in SPEC §7.2.
