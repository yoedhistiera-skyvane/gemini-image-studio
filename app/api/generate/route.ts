import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Verified against ai.google.dev as of May 2026.
const MODELS = {
  'imagen-4.0-fast-generate-001': {
    family: 'imagen', label: 'Imagen 4 Fast', basePrice: 0.02,
    supportsNativeMulti: true, supportsResolution: false,
  },
  'imagen-4.0-generate-001': {
    family: 'imagen', label: 'Imagen 4', basePrice: 0.04,
    supportsNativeMulti: true, supportsResolution: false,
  },
  'imagen-4.0-ultra-generate-001': {
    family: 'imagen', label: 'Imagen 4 Ultra', basePrice: 0.06,
    supportsNativeMulti: false, supportsResolution: false,
  },
  'gemini-2.5-flash-image': {
    family: 'gemini', label: 'Nano Banana', basePrice: 0.039,
    supportsNativeMulti: false, supportsResolution: false,
  },
  'gemini-3.1-flash-image-preview': {
    family: 'gemini', label: 'Nano Banana 2', basePrice: 0.045,
    supportsNativeMulti: false, supportsResolution: false,
  },
  'gemini-3-pro-image-preview': {
    family: 'gemini', label: 'Nano Banana Pro', basePrice: 0.134,
    supportsNativeMulti: false, supportsResolution: true,
    resolutionPricing: { '1K': 0.134, '2K': 0.20, '4K': 0.24 } as Record<string, number>,
  },
} as const;

type ModelId = keyof typeof MODELS;
type Resolution = '1K' | '2K' | '4K';

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  aspectRatio?: string;
  numberOfImages?: number;
  resolution?: Resolution;
  negativePrompt?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY env variable not set on the server.' },
      { status: 500 }
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    prompt, model, aspectRatio = '1:1',
    numberOfImages = 1, resolution = '1K', negativePrompt,
  } = body;

  if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  if (!model || !(model in MODELS)) return NextResponse.json({ error: 'Invalid model.' }, { status: 400 });

  const config = MODELS[model];
  const t0 = Date.now();

  try {
    let images: { data: string; mimeType: string }[];

    if (config.family === 'imagen') {
      images = await callImagen(apiKey, model, prompt, aspectRatio, numberOfImages, negativePrompt);
    } else {
      // Gemini native returns 1 image per call → parallel fan-out
      const count = Math.max(1, Math.min(4, numberOfImages));
      const calls = Array.from({ length: count }, () =>
        callGemini(apiKey, model, prompt, aspectRatio, resolution, negativePrompt)
      );
      const results = await Promise.all(calls);
      images = results.flat();
    }

    const perImage =
      'resolutionPricing' in config && config.resolutionPricing
        ? config.resolutionPricing[resolution] ?? config.basePrice
        : config.basePrice;

    return NextResponse.json({
      images,
      model,
      modelLabel: config.label,
      estimatedCost: (perImage * images.length).toFixed(4),
      elapsedMs: Date.now() - t0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, elapsedMs: Date.now() - t0 }, { status: 500 });
  }
}

async function callImagen(
  apiKey: string, model: ModelId, prompt: string,
  aspectRatio: string, sampleCount: number, negativePrompt?: string
) {
  const isUltra = model === 'imagen-4.0-ultra-generate-001';
  const safeCount = isUltra ? 1 : Math.max(1, Math.min(4, sampleCount));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

  const parameters: Record<string, unknown> = { sampleCount: safeCount, aspectRatio };
  if (negativePrompt?.trim()) parameters.negativePrompt = negativePrompt.trim();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ instances: [{ prompt }], parameters }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const predictions = json.predictions || [];
  if (predictions.length === 0) {
    throw new Error('No images returned. Prompt may have been blocked by safety filters.');
  }
  return predictions.map((p: any) => ({
    data: p.bytesBase64Encoded,
    mimeType: p.mimeType || 'image/png',
  }));
}

async function callGemini(
  apiKey: string, model: ModelId, prompt: string,
  aspectRatio: string, resolution: Resolution, negativePrompt?: string
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const parts: string[] = [prompt];
  if (aspectRatio !== '1:1') parts.push(`Aspect ratio: ${aspectRatio}.`);
  if (model === 'gemini-3-pro-image-preview' && resolution !== '1K') {
    parts.push(`Render at ${resolution} resolution.`);
  }
  if (negativePrompt?.trim()) parts.push(`Avoid: ${negativePrompt.trim()}.`);
  const fullPrompt = parts.join('\n\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const respParts = json?.candidates?.[0]?.content?.parts || [];
  const images = respParts
    .filter((p: any) => p.inlineData?.data)
    .map((p: any) => ({
      data: p.inlineData.data,
      mimeType: p.inlineData.mimeType || 'image/png',
    }));

  if (images.length === 0) {
    const textPart = respParts.find((p: any) => p.text)?.text;
    throw new Error(
      textPart
        ? `Model returned text instead of image: ${textPart.slice(0, 200)}`
        : 'No image data in response. Prompt may have been blocked.'
    );
  }
  return images;
}

export async function GET() {
  return NextResponse.json({
    models: Object.entries(MODELS).map(([id, m]) => ({ id, ...m })),
  });
}
