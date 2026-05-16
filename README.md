# Gemini Image Studio v4

A Next.js app for generating **brand-consistent marketing assets** via Google Gemini + Claude.

**Smart Mode** is the headline feature: Claude (Sonnet 4.6) acts as your creative director — picks the strategic angle, writes the headline, briefs Gemini with specific photographic direction. Gemini's Nano Banana Pro then renders the asset using your uploaded brand references.

## How Smart Mode works

```
You enter:                          Claude returns:                Gemini renders:
- Product name                      - Strategic angle              - Final image with
- Category                          - Headline (10 words max)        embedded headline
- Audience                  →       - Subhead              →       - Brand-consistent
- Key benefit                       - Image direction                product
- Tone, Goal                        - Negative prompt              - Correct text
- Reference images                  - Composition, lighting,         (uses your refs)
                                      mood, palette
```

The brief is fully transparent — you see Claude's headline, rationale, and visual direction *before* the image renders. You learn what works.

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with BOTH keys (Gemini + Claude)
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Import at https://vercel.com/new
3. Add **both** env vars:
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey
   - `ANTHROPIC_API_KEY` from https://console.anthropic.com/settings/keys
4. Deploy

If you only set `GEMINI_API_KEY`, Manual Mode works. Smart Mode requires both.

## Smart Mode inputs

- **Product name** (required) — e.g. "Fomin Clean Facial Towels"
- **Category** (required) — Skincare / Supplement / Beverage / Food / Cosmetics / Apparel / Home / Tech / Service / Other
- **Target audience** — e.g. "Adults with sensitive skin"
- **Key benefit** — the one thing this product does better than alternatives
- **Brand tone** — Premium / Friendly / Clinical / Playful / Minimalist / Bold
- **Campaign goal** — Awareness / Conversion / Education / Trust-building
- **Strategic angle** *(optional)* — leave empty for Claude to auto-pick, or pick from category-specific suggestions, or type your own. When provided, Claude executes that angle instead of choosing one.

The fewer inputs you give, the more Claude has to invent. Premium results come from specific, honest inputs.

## Cost per generation

| Stage | Cost |
|---|---|
| Claude brief (Sonnet 4.6) | ~$0.003 |
| Nano Banana Pro @ 2K | $0.20 |
| **Total per asset** | **~$0.20** |

The brief cost is rounding error. The image cost dominates.

## Architecture

```
app/
├── api/
│   ├── brief/route.ts    ← Claude writes the creative brief (JSON)
│   └── generate/route.ts ← Gemini renders the image
├── page.tsx              ← Mode toggle, brief display, image grid
├── layout.tsx
└── globals.css
```

## Models used

- **Claude Sonnet 4.6** (`claude-sonnet-4-6`) for creative briefs — $3/$15 per MTok
- **Gemini Nano Banana Pro** (`gemini-3-pro-image-preview`) default for images — $0.134-0.24/img
- All other Gemini image models still available in the dropdown

## Why two AI providers?

Different models are best at different things. Claude is materially stronger at marketing copywriting (testable — try writing 10 headlines on both, compare). Gemini's Nano Banana Pro is materially stronger at reference-aware image generation with embedded text. Combining them gives you a better tool than either alone.

## Manual Mode

If you want full control or don't want to use Claude, switch to Manual Mode in the top-right toggle. You get the raw prompt + negative prompt + style preset controls. Same image generation, no Claude involvement.

## Caveats (read these)

- **Smart Mode needs ANTHROPIC_API_KEY.** Without it, Smart generation fails with a clear error. Manual Mode keeps working.
- **Claude returns JSON.** If the model ever returns prose instead (rare), the brief route surfaces the parse error so you can retry.
- **The image model still does the actual rendering.** Claude can write a perfect brief, but Nano Banana Pro might still occasionally garble text or hallucinate details. Brand references (logo + product photo) are your best defense.
- **All images carry a SynthID watermark.** Google policy.
- **No free tier on either API.** Use AI Studio (https://aistudio.google.com) and Claude.ai for free experimentation.

## Example: real workflow for a packaged product ad

1. **Smart Mode**
2. **Upload references:** your real logo (role: Logo) + a real packaging photo (role: Product)
3. **Product name:** Fomin Clean Facial Towels
4. **Category:** Personal Care
5. **Audience:** Adults with sensitive skin or eczema
6. **Key benefit:** Gentle enough for daily use during flare-ups
7. **Tone:** Friendly · **Goal:** Trust-building
8. **Aspect:** Feed 4:5 · **Resolution:** 2K
9. Click **✨ Generate Smart Asset**

Claude picks an angle like "Quiet relief, real skin testimonial," writes a headline like "Skin that finally calms down," then briefs Gemini for an intimate, soft-light close-up. Gemini uses your real logo and packaging to render the asset.

Total time: ~20 seconds. Total cost: ~$0.20.
