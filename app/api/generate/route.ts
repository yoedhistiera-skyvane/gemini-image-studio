import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel: allow up to 60s for Ultra/Pro models

// Model registry — single source of truth.
// Verified against Google docs as of May 2026.
const MODELS = {
  'imagen-4.0-fast-generate-001': { family: 'imagen', label: 'Imagen 4 Fast', price: 0.02 },
  'imagen-4.0-generate-001':       { family: 'imagen', label: 'Imagen 4',      price: 0.04 },
  'imagen-4.0-ultra-generate-001': { family: 'imagen', label: 'Imagen 4 Ultra', price: 0.06 },
  'gemini-2.5-flash-image':         { family: 'gemini', label: 'Nano Banana',    price: 0.039 },
  'gemini-3.1-flash-image-preview': { family: 'gemini', label: 'Nano Banana 2',  price: 0.045 },
  'gemini-3-pro-image-preview':     { family: 'gemini', label: 'Nano Banana Pro', price: 0.134 },
} as const;

type ModelId = keyof typeof MODELS;

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  numberOfImages?: number; // Imagen only, 1-4. Ultra is 1 only.
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

  const { prompt, model, aspectRatio = '1:1', numberOfImages = 1 } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }
  if (!model || !(model in MODELS)) {
    return NextResponse.json({ error: 'Invalid model.' }, { status: 400 });
  }

  const config = MODELS[model];

  try {
    const images =
      config.family === 'imagen'
        ? await callImagen(apiKey, model, prompt, aspectRatio, numberOfImages)
        : await callGemini(apiKey, model, prompt, aspectRatio);

    return NextResponse.json({
      images,
      model,
      modelLabel: config.label,
      estimatedCost: (config.price * images.length).toFixed(4),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Imagen 4 family — uses :predict endpoint.
 * Response: { predictions: [{ bytesBase64Encoded, mimeType }] }
 */
async function callImagen(
  apiKey: string,
  model: ModelId,
  prompt: string,
  aspectRatio: string,
  sampleCount: number
): Promise<{ data: string; mimeType: string }[]> {
  // Imagen 4 Ultra only supports 1 image per call
  const safeCount = model === 'imagen-4.0-ultra-generate-001' ? 1 : Math.max(1, Math.min(4, sampleCount));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: safeCount,
        aspectRatio,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const predictions = json.predictions || [];
  if (predictions.length === 0) {
    throw new Error('No images returned. The prompt may have been blocked by safety filters.');
  }

  return predictions.map((p: any) => ({
    data: p.bytesBase64Encoded,
    mimeType: p.mimeType || 'image/png',
  }));
}

/**
 * Gemini native image (Nano Banana family) — uses :generateContent.
 * Response: candidates[0].content.parts[] — find parts with inlineData.
 * MUST request both TEXT and IMAGE modalities.
 */
async function callGemini(
  apiKey: string,
  model: ModelId,
  prompt: string,
  aspectRatio: string
): Promise<{ data: string; mimeType: string }[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Aspect ratio for Gemini native is best expressed inside the prompt;
  // the explicit param isn't officially supported across all preview models.
  const fullPrompt =
    aspectRatio === '1:1'
      ? prompt
      : `${prompt}\n\n(Render at ${aspectRatio} aspect ratio.)`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];

  const images = parts
    .filter((p: any) => p.inlineData?.data)
    .map((p: any) => ({
      data: p.inlineData.data,
      mimeType: p.inlineData.mimeType || 'image/png',
    }));

  if (images.length === 0) {
    const textPart = parts.find((p: any) => p.text)?.text;
    throw new Error(
      textPart
        ? `Model returned text instead of an image: ${textPart.slice(0, 200)}`
        : 'No image data in response. The prompt may have been blocked.'
    );
  }

  return images;
}

export async function GET() {
  return NextResponse.json({
    models: Object.entries(MODELS).map(([id, m]) => ({ id, ...m })),
  });
}
