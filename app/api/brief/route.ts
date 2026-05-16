import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface BriefRequest {
  productName: string;
  category: string;
  audience?: string;
  keyBenefit?: string;
  brandTone?: string;
  campaignGoal?: string;
  userAngle?: string;        // user-supplied strategic angle (overrides auto-pick)
  language?: string;
  hasReferences?: boolean;
}

// What we ask Claude to return — strict JSON schema
interface CreativeBrief {
  headline: string;
  subhead: string;
  angle: string;             // strategic angle name, e.g. "Problem-solution testimonial"
  rationale: string;         // why this angle fits
  imagePrompt: string;       // ready-to-use prompt for Nano Banana Pro
  negativePrompt: string;    // things to avoid
  composition: string;       // shot type, framing
  lighting: string;          // lighting style
  mood: string;              // emotional tone
  palette: string;           // color guidance
}

export async function POST(req: NextRequest) {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY env variable not set on the server.' },
      { status: 500 }
    );
  }

  let body: BriefRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    productName, category,
    audience = '', keyBenefit = '',
    brandTone = 'Premium', campaignGoal = 'Awareness',
    userAngle = '',
    language = 'en', hasReferences = false,
  } = body;

  if (!productName?.trim() || !category?.trim()) {
    return NextResponse.json({ error: 'productName and category are required.' }, { status: 400 });
  }

  const hasUserAngle = userAngle.trim().length > 0;

  const systemPrompt = `You are a senior creative director at a top-tier advertising agency. You specialize in crafting marketing visuals that stop people scrolling. Your taste is sharp, your headlines are tight, your visual direction is specific.

When given a product brief, you:
1. ${hasUserAngle
    ? `EXECUTE the strategic angle the user has specified. Do not second-guess it, do not water it down, do not pivot. The user has chosen the direction — your job is to make it land.`
    : `Pick the SINGLE strongest strategic angle for this product + audience + goal. Don't hedge with multiple options — commit.`}
2. Write ONE headline (max 10 words) that earns attention. No clickbait. No exclamation marks. No clichés like "Discover...", "Transform...", "Unleash...".
3. Write ONE subhead (max 20 words) that pays off the headline with substance.
4. Write an image prompt that is SPECIFIC about: scene, framing, lighting, mood, what the product is doing in the shot. Treat the image model like a photographer you're briefing — say "shot on 50mm, soft window light from camera-left" not "looks professional".
5. Always include the product naturally in the scene — never floating, never on a pure white background unless that IS the strategic choice.

Category conventions you know:
- Skincare/wipes: hero the texture, the relief, the ritual. Avoid generic "spa" shots. Real skin, soft natural light, intimate framing wins.
- Supplement: lifestyle moment, not pill-on-counter. Show the outcome (energy, focus, calm) — not the product alone.
- Beverage: condensation, glass, hand, environment context.
- Cosmetics: macro on texture/swatch, OR confident portrait wearing the product.
- Apparel: human in motion, real-world environment, never floating mannequin.
- Tech: in-use scene, hands on device, environment that signals the user persona.
- Food/snack: top-down or 3/4 hero with crumbs, hand reaching in — never sterile.

You return ONLY valid JSON matching this exact schema. No prose before or after. No markdown fences.
{
  "headline": "string, max 10 words",
  "subhead": "string, max 20 words",
  "angle": "short label for the strategic angle, e.g. 'Problem-solution testimonial' or 'Quiet ritual lifestyle'",
  "rationale": "one sentence on why this angle fits this product+audience",
  "imagePrompt": "specific photographic brief, 3-5 sentences",
  "negativePrompt": "comma-separated list of things to avoid in the image",
  "composition": "shot type and framing in one phrase",
  "lighting": "lighting setup in one phrase",
  "mood": "emotional tone in 2-3 words",
  "palette": "color guidance in one phrase"
}`;

  const userPrompt = buildUserPrompt({
    productName, category, audience, keyBenefit,
    brandTone, campaignGoal, userAngle, language, hasReferences,
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = await res.json();
    const textBlock = json.content?.find((c: any) => c.type === 'text')?.text;
    if (!textBlock) throw new Error('No text in Claude response');

    // Strip any code fences just in case
    const cleaned = textBlock.replace(/```json\n?|```\n?/g, '').trim();
    let brief: CreativeBrief;
    try {
      brief = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`);
    }

    // Validate required fields
    const required: (keyof CreativeBrief)[] = ['headline', 'subhead', 'angle', 'imagePrompt'];
    for (const field of required) {
      if (!brief[field]) throw new Error(`Brief missing required field: ${field}`);
    }

    return NextResponse.json({
      brief,
      usage: {
        inputTokens: json.usage?.input_tokens || 0,
        outputTokens: json.usage?.output_tokens || 0,
        // Sonnet 4.6: $3/M input, $15/M output
        estimatedCost: (
          (json.usage?.input_tokens || 0) * 3 / 1_000_000 +
          (json.usage?.output_tokens || 0) * 15 / 1_000_000
        ).toFixed(5),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildUserPrompt(p: {
  productName: string; category: string;
  audience: string; keyBenefit: string;
  brandTone: string; campaignGoal: string;
  userAngle: string;
  language: string; hasReferences: boolean;
}): string {
  const lines: string[] = [
    `Brief me on a marketing visual for this product. Return only the JSON object.`,
    ``,
    `PRODUCT: ${p.productName}`,
    `CATEGORY: ${p.category}`,
  ];
  if (p.audience) lines.push(`TARGET AUDIENCE: ${p.audience}`);
  if (p.keyBenefit) lines.push(`KEY BENEFIT: ${p.keyBenefit}`);
  lines.push(`BRAND TONE: ${p.brandTone}`);
  lines.push(`CAMPAIGN GOAL: ${p.campaignGoal}`);
  if (p.userAngle) {
    lines.push('');
    lines.push(`STRATEGIC ANGLE (USER-CHOSEN — EXECUTE THIS, DO NOT REPLACE): ${p.userAngle}`);
    lines.push(`Set the "angle" field in your JSON response to: ${p.userAngle}`);
  }
  if (p.language !== 'en') lines.push(`LANGUAGE: ${p.language} (headline and subhead in this language)`);
  if (p.hasReferences) {
    lines.push('');
    lines.push(`NOTE: The user will attach reference images (logo + product packaging) to the image generator. In your imagePrompt, write as if the actual product packaging is available — say "the product packaging shown in the reference" rather than describing how the box should look. This ensures brand fidelity.`);
  }
  return lines.join('\n');
}
