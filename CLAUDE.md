# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install deps (Node `^22.18.0 || >=24.12.0`)
- `npm run dev` — Vite dev server with HMR (includes vue-devtools plugin)
- `npm run build` / `npm run preview` — production build / serve it

There is no test runner or linter configured.

## Architecture

ColorScrap is a small Vue 3 + Vite + Tailwind 3 (PostCSS) app, a university AI final project. UI text is in Thai, and so are code comments — keep that convention. `@` aliases `src/` (vite.config.js, jsconfig.json).

Two independent features, both self-contained in `src/components/`:

- `CanvasBoard.vue` (the only component mounted, via `App.vue`) — emotion picker plus a WebGL fluid simulation (`webgl-fluid-enhanced`) on a canvas. Each emotion maps to a hex colour; toggling emotions rewrites `fluidInstance.config.COLOR_PALETTE` live on the single instance created in `onMounted`. The "extract colours and save to Scrapbook" button is not wired up yet.
- `ColorTester.vue` (not mounted anywhere yet) — uploads an image and extracts a 5-colour palette with Color Thief.

## Gotchas

- Keep the fluid instance in a plain `let`, never `ref()`/`reactive()`: Vue proxies interfere with WebGL. `colorful` must stay `true` or the library ignores `colorPalette`.
- `ColorTester.vue` uses `new window.ColorThief()`, which comes from a CDN `<script>` tag (color-thief 2.4.0) in `index.html`. The npm `colorthief` dependency (v3, different API) is not used by it.
- `src/router/index.js` is created and installed in `main.js`, but `routes` is empty, so there is no `<RouterView>` and no navigation yet.
