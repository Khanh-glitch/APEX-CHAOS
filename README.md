# APEX CHAOS

Production-ready Vite/React game build.

## Local development

```powershell
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`.

## Production build

```powershell
pnpm build
```

Deploy the generated `dist/` directory. For Netlify, use:

- Build command: `pnpm build`
- Publish directory: `dist`

## Project structure

- `src/App.jsx`: React UI and game shell.
- `src/styles.css`: responsive UI styling.
- `public/apexEngine.js`: canonical gameplay runtime.
- `public/assets/`: canonical production assets; all raster images use WebP.
- `tools/generatePublicAssetManifest.cjs`: build-time asset manifest generator.
- `tools/convertAssetsToWebp.py`: verified bulk PNG-to-WebP migration utility.
