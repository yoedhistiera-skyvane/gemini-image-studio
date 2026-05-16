# Gemini Image Studio v3

A polished Next.js app for generating brand-consistent images via the Google Gemini API. **v3 adds reference image uploads** so you can lock generations to your logo, product packaging, and visual style.

## What's in v3

### Brand reference uploads (the big one)
Upload up to **14 reference images** (logo, product shots, style boards, palettes). The model uses them to keep brand visuals consistent.

- Drag-and-drop or click to upload
- Each image gets a **role tag** (Logo / Product / Style / Palette / Other) so the model knows how to use it
- Filename auto-detects role (e.g. "logo.png" → Logo)
- Thumbnails with one-click remove
- Auto-validates: 14 images max, 18MB total payload
- Auto-warns when current model can't use references (Imagen 4 family)

### Plus everything from v2
- Platform-sized aspect ratios (Square, Feed, Story, Wide, Photo)
- Dynamic cost preview (recalculates live)
- Progress bar with elapsed seconds + estimated total
- Resolution selector for Nano Banana Pro (1K/2K/4K)
- Negative prompts
- Style presets (Product photo, Cinematic, Editorial, Flat-lay, Minimal 3D, Illustration)

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

## Which model supports what

| Model | Reference images | Resolution control | Multi-image |
|---|---|---|---|
| Imagen 4 Fast | ❌ | ❌ | ✅ Native (1-4) |
| Imagen 4 | ❌ | ❌ | ✅ Native (1-4) |
| Imagen 4 Ultra | ❌ | ❌ | ❌ (1 only) |
| Nano Banana | ✅ Up to 14 | ❌ | Fan-out |
| Nano Banana 2 | ✅ Up to 14 | ❌ | Fan-out |
| **Nano Banana Pro** | ✅ Up to 14 | ✅ 1K/2K/4K | Fan-out |

**For brand-consistent work, use Nano Banana Pro.** It's the only model with both reference support AND high-resolution output, and it's specifically tuned for text rendering (critical for product packaging).

## Recommended workflow for brand-safe assets

1. **Upload your logo** as a clean PNG with transparent background → tag as **Logo**
2. **Upload 1-2 product shots** (existing packaging photos) → tag as **Product**
3. *Optional*: upload a style/mood reference → tag as **Style**
4. Pick **Nano Banana Pro** + **2K resolution**
5. In the prompt, describe the *scene* (where the product sits, lighting, mood) — NOT the product itself
6. In **negative prompt**, add: `text overlays, captions, headers, watermarks, extra logos, blur`
7. Generate

**Example prompt for a lifestyle shot of facial towels:**
> A serene morning bathroom scene: the product placed on a marble countertop next to a small terracotta pot with a green plant. Soft natural light from the left. Steam rising in the background. Calm, premium spa aesthetic.

The model uses your uploaded references to keep the product, logo, and brand colors accurate while inventing only the scene around them.

## Caveats (read these)

- **Nano Banana returns 1 image per API call.** Requesting 4 makes 4 parallel calls. Cost scales linearly.
- **Reference images count toward the 20MB request limit.** The app enforces ~18MB safely. For larger payloads, the Files API would be needed (not implemented here — let me know if you need it).
- **Progress bar is estimated, not streamed.** Gemini API doesn't provide real-time progress for image generation.
- **All images carry a SynthID watermark.** Google policy.
- **No free tier on API.** Use AI Studio (https://aistudio.google.com) for free testing.
- **Imagen 4 family ignores references entirely.** If you upload refs and pick an Imagen model, the app blocks generation with a clear warning.

## Architecture

```
app/
├── api/generate/route.ts   ← Server-side. Handles refs via inlineData parts.
├── page.tsx                 ← Client UI with file upload + role tagging
├── layout.tsx
└── globals.css
```

## API contract (if you want to call it yourself)

`POST /api/generate`:
```json
{
  "prompt": "string",
  "model": "gemini-3-pro-image-preview",
  "aspectRatio": "1:1",
  "numberOfImages": 1,
  "resolution": "2K",
  "negativePrompt": "watermarks, blur",
  "references": [
    { "data": "base64...", "mimeType": "image/png", "role": "logo", "label": "fomin-logo.png" }
  ]
}
```

Returns:
```json
{
  "images": [{ "data": "base64...", "mimeType": "image/png" }],
  "model": "gemini-3-pro-image-preview",
  "modelLabel": "Nano Banana Pro",
  "estimatedCost": "0.2000",
  "elapsedMs": 12450,
  "referencesUsed": 2
}
```
