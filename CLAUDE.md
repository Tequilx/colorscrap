# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install deps (Node `^22.18.0 || >=24.12.0`)
- `npm run dev` — Vite dev server with HMR (includes vue-devtools plugin). UI kit gallery (dev only) at `/?kit`
- `npm run build` / `npm run preview` — production build / serve it

There is no test runner or linter configured yet (SPEC §10 plans Vitest for `palette.js`).

## Architecture

ColorScrap is a Vue 3 + Vite + Tailwind 3 (PostCSS) app, a university AI final project: a watercolour mood sketchbook. **`docs/SPEC.md` is the source of truth** (read it before building a screen); reference mockups are in `docs/design/screens/` and `docs/design/style-board.html`. Plain JavaScript only (no TypeScript), `<script setup>`. UI text is in Thai, and so are code comments — keep that convention. `@` aliases `src/` (vite.config.js, jsconfig.json).

- **Single "desk", no router.** The whole app is one fixed 1280×800 stage (`components/desk/Stage.vue`) scaled to fit the window. The current screen is `view` in the Pinia store `stores/app.js` (`hello | cover | pick | paint | saved | book`); transitions go through `go()` which enforces the table in SPEC §4.1. Persistent objects (`Scrapbook`, `DrawingBoard`, `EmotionPalette`) are never unmounted — they move/fade by `view`. Sync `view` with `location.hash` for the back button; do not add Vue Router.
- **Design tokens live in `src/lib/tokens.js` only** (plain data, no Vue imports). `tailwind.config.js` imports it, so use utilities (`bg-desk`, `text-ink-soft`, `bg-e-calm`, `font-hand`, `rounded-hand`, `ease-desk`) and never hard-code hex in components. Only runtime-changeable values (`--cover`, `--cover-spine`, `--cover-strap`) are CSS variables in `styles/tokens.css`. Cover spine/strap use plain RGB `mixRgb` (`lib/color.js`); `mixColors` (SPEC §8, HSL) is only for the daily palette.
- `components/ui/` is the kit (`HandButton`, `Tape`, `Polaroid`, `EmotionBlob`, `Doodle`, `WatercolorBlob`). SVG paths for faces, avatars, icons and blobs are in `lib/emotions.js` / `lib/doodles.js`.
- `src/KitGallery.vue` renders every kit component; it is lazy-loaded by `App.vue` only when `import.meta.env.DEV` and the URL has `?kit`.

## Gotchas

- SVG filters (`wob`, `wc`, `wcm`, `wct`, `wcs`, `grain`) are defined once in `SvgDefs.vue` and used as `filter-wob` etc. Never put `wob` on large areas, things that animate constantly, or long text (put it on a frame element, as `HandButton` does) — iPad Safari performance.
- Keep the fluid instance in a plain `let`, never `ref()`/`reactive()`: Vue proxies interfere with WebGL. With `webgl-fluid-enhanced`, `colorful` must stay `true` or the library ignores `colorPalette`. Whether to keep this library or port PavelDoGreat's simulation (SPEC §6) is decided at step 5; `components/CanvasBoard.vue` is the old prototype (not mounted) until it becomes `paint/FluidCanvas.vue`.
- Colours of a saved painting are extracted with the **npm** `colorthief` v3 (`getPaletteSync`, returns Color objects with `.hex()`), not the old v2 CDN `window.ColorThief` — that script tag is gone. Entries store `colors: [{ hex, ratio }]` (SPEC §6.6, §7.2).
- Mock data (steps 3–4) must use the same entry shape as the Supabase schema in SPEC §7.2.
