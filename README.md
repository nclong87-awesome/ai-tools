# My App

React + TypeScript + Vite frontend for Agent Framework.

## Local development

```bash
npm install
npm run dev
```

By default the app calls `/api`, and Vite proxies that path to `http://localhost:8888` in development.

You can override the dev proxy target:

```bash
VITE_DEV_API_PROXY_TARGET=http://localhost:9000 npm run dev
```

## Build

```bash
npm run build
```

GitHub Pages build (uses project path `/ai-tools/`):

```bash
npm run build:pages
```

## Publish to GitHub Pages

This repository includes a workflow at `.github/workflows/deploy-pages.yml` that deploys `App/dist` to Pages on every push to `main`.

1. Open repository Settings -> Pages.
2. Set Source to GitHub Actions.
3. (Optional but recommended) In Settings -> Secrets and variables -> Actions -> Variables, create `VITE_API_BASE_URL` with your public API URL (for example `https://api.example.com`).
4. Push to `main`.

After deployment, the app will be available at `https://nclong87-awesome.github.io/ai-tools/`.
