# Gemini Image Studio v2

A polished Next.js app for generating images via the Google Gemini API. v2 adds platform-sized aspect ratios, dynamic cost preview, real-time progress with elapsed seconds, resolution control for Nano Banana Pro (1K/2K/4K), negative prompts, style presets, and smart UI logic.

## What's new in v2

- **Platform-sized aspect ratios** — Square (1080×1080), Feed (1080×1350), Story (1080×1920), Wide, Photo
- **Dynamic cost** — updates as you change model × quantity × resolution
- **Real-time progress** — elapsed seconds + estimated total + percentage bar
- **Resolution selector for Nano Banana Pro** — 1K / 2K / 4K with tier pricing
- **Negative prompts** — native for Imagen 4, appended as "Avoid: X" for Nano Banana
- **Style presets** — Product, Cinematic, Editorial, Flat-lay, Minimal 3D, Illustration
- **Smart quantity logic** — hidden for Imagen 4 Ultra (which only returns 1 per call)

## Quick start (local)

```bash
npm install
cp .env.example .env.local
# Edit .env.local, paste your key from https://aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Import at https://vercel.com/new
3. Add env var `GEMINI_API_KEY`
4. Deploy

Or with Vercel CLI:
```bash
npm install -g vercel
vercel
vercel env add GEMINI_API_KEY
vercel --prod
```

## Models

| Model ID | Family | Price | Notes |
|---|---|---|---|
| `imagen-4.0-fast-generate-001` | Imagen | $0.020 | High-volume drafts |
| `imagen-4.0-generate-001` | Imagen | $0.040 | Balanced |
| `imagen-4.0-ultra-generate-001` | Imagen | $0.060 | Top photorealism, 1/call |
| `gemini-3.1-flash-image-preview` | Gemini | $0.045 | Nano Banana 2 |
| `gemini-3-pro-image-preview` | Gemini | $0.134 - $0.24 | Nano Banana Pro, 1K-4K |
| `gemini-2.5-flash-image` | Gemini | $0.039 | Original Nano Banana |

Prices verified May 2026.

## Important caveats

- **Nano Banana models return 1 image per API call.** Requesting 4 makes 4 parallel calls. Cost scales linearly.
- **Progress bar is estimated, not streamed.** The Gemini API has no progress callback for image generation. The bar uses typical timing per model and is transparent about it.
- **Nano Banana Pro resolution param is passed in-prompt**, since the official `:generateContent` endpoint doesn't expose a structured `resolution` parameter for preview models.
- **All images carry a SynthID watermark.**
- **No free tier on the API.** Use AI Studio (https://aistudio.google.com) for free testing.

## Architecture

```
app/
├── api/generate/route.ts   ← Server-side. API key. Routes to Imagen or Gemini.
├── page.tsx                 ← Client UI with progress, cost preview, presets
├── layout.tsx
└── globals.css
```
