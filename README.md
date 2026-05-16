# Gemini Image Studio

A minimal, production-ready Next.js app for generating images via the Google Gemini API. Supports both model families:

- **Imagen 4** (Fast / Standard / Ultra) — dedicated text-to-image, cheapest
- **Nano Banana** family (v1 / v2 / Pro) — Gemini-native, strong text rendering

Your API key stays server-side. The browser never sees it.

## Quick start (local)

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste your key
npm run dev
```

Open http://localhost:3000

Get a key at https://aistudio.google.com/apikey

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to https://vercel.com/new and import the repo
3. In **Environment Variables**, add:
   - Key: `GEMINI_API_KEY`
   - Value: your key from Google AI Studio
4. Deploy

That's it. No other config needed.

## Models supported

| Model ID | Family | Price/img | Notes |
|---|---|---|---|
| `imagen-4.0-fast-generate-001` | Imagen | $0.020 | Cheapest, high volume |
| `imagen-4.0-generate-001` | Imagen | $0.040 | Balanced |
| `imagen-4.0-ultra-generate-001` | Imagen | $0.060 | Top photorealism, 1 img/call |
| `gemini-2.5-flash-image` | Gemini | $0.039 | Original Nano Banana |
| `gemini-3.1-flash-image-preview` | Gemini | $0.045 | Nano Banana 2, 4K capable |
| `gemini-3-pro-image-preview` | Gemini | $0.134 | Nano Banana Pro, best quality |

Prices verified May 2026 — check https://ai.google.dev/pricing for current rates.

## Architecture

```
app/
├── api/generate/route.ts   ← Server-side API route. Holds the key.
├── page.tsx                 ← Client UI.
├── layout.tsx
└── globals.css
```

The API route handles both endpoint shapes:
- Imagen → `POST /v1beta/models/{model}:predict`
- Nano Banana → `POST /v1beta/models/{model}:generateContent` with `responseModalities: ['TEXT', 'IMAGE']`

## Notes

- Imagen 4 Ultra only returns 1 image per call — the UI handles this automatically
- All images include a SynthID watermark (Google policy, can't be disabled)
- The Gemini API has no free tier for image generation as of 2026 — every call is billed
- For free experimentation, use Google AI Studio (~500 images/day free) at https://aistudio.google.com
- Default Vercel function timeout is 10s; this app sets `maxDuration = 60` for Ultra/Pro models

## Extending

To add image editing (upload + modify), use the Nano Banana models and pass image data alongside the text prompt in `contents.parts`. The Imagen models do not support editing.
