# bqsgwys.github.io

Next.js frontend homepage with automatic CI/CD deployment to GitHub Pages.

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build Static Files

```bash
npm run build
```

The static export output is generated in `out/`.

## GitHub Pages CI/CD

Workflow file: `.github/workflows/deploy.yml`

Trigger:
- Push to `main`
- Manual run from Actions page

Pipeline:
1. `npm ci`
2. `npm run build` (Next.js static export)
3. Upload `out/`
4. Deploy to GitHub Pages

## Repository Settings Required

In GitHub repository:
1. Open `Settings` -> `Pages`
2. Under `Build and deployment`, set `Source` to `GitHub Actions`

## Notes

- `next.config.ts` is already configured for:
  - `output: "export"`
  - `images.unoptimized: true`
  - auto `basePath/assetPrefix` for project repo deployment
- For `username.github.io` repositories, root path is used automatically.
