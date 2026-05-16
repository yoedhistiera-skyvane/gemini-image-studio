'use client';

import { useState, useEffect, useRef } from 'react';

type ModelId =
  | 'imagen-4.0-fast-generate-001'
  | 'imagen-4.0-generate-001'
  | 'imagen-4.0-ultra-generate-001'
  | 'gemini-2.5-flash-image'
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview';

type Resolution = '1K' | '2K' | '4K';

interface ModelOption {
  id: ModelId;
  label: string;
  family: 'imagen' | 'gemini';
  basePrice: number;
  resolutionPricing?: Record<Resolution, number>;
  supportsNativeMulti: boolean;
  supportsResolution: boolean;
  estSeconds: number;
  note: string;
}

const MODELS: ModelOption[] = [
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast',     family: 'imagen', basePrice: 0.02,  supportsNativeMulti: true,  supportsResolution: false, estSeconds: 4,  note: 'Cheapest. Use for high-volume drafts.' },
  { id: 'imagen-4.0-generate-001',      label: 'Imagen 4',          family: 'imagen', basePrice: 0.04,  supportsNativeMulti: true,  supportsResolution: false, estSeconds: 6,  note: 'Balanced quality and cost.' },
  { id: 'imagen-4.0-ultra-generate-001',label: 'Imagen 4 Ultra',    family: 'imagen', basePrice: 0.06,  supportsNativeMulti: false, supportsResolution: false, estSeconds: 10, note: 'Top photorealism. 1 image per call.' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2',   family: 'gemini', basePrice: 0.045, supportsNativeMulti: false, supportsResolution: false, estSeconds: 8,  note: 'Strong text rendering. 4K capable.' },
  { id: 'gemini-3-pro-image-preview',   label: 'Nano Banana Pro',   family: 'gemini', basePrice: 0.134, supportsNativeMulti: false, supportsResolution: true,  estSeconds: 14, note: 'Flagship. Best text + reasoning.',
    resolutionPricing: { '1K': 0.134, '2K': 0.20, '4K': 0.24 } },
  { id: 'gemini-2.5-flash-image',       label: 'Nano Banana (v1)',  family: 'gemini', basePrice: 0.039, supportsNativeMulti: false, supportsResolution: false, estSeconds: 6,  note: 'Original Nano Banana. Stable.' },
];

const ASPECT_PRESETS = [
  { label: 'Square', ratio: '1:1',  dims: '1080 × 1080', use: 'IG post' },
  { label: 'Feed',   ratio: '4:3',  dims: '1080 × 1350', use: 'IG / FB feed' },
  { label: 'Story',  ratio: '9:16', dims: '1080 × 1920', use: 'Story / Reel' },
  { label: 'Wide',   ratio: '16:9', dims: '1920 × 1080', use: 'YouTube / web' },
  { label: 'Photo',  ratio: '3:4',  dims: '1080 × 1440', use: 'Portrait shot' },
] as const;

const STYLE_PRESETS = [
  { id: 'none',         label: 'None',              suffix: '' },
  { id: 'product',      label: 'Product photo',     suffix: 'Studio product photography, soft directional lighting, shallow depth of field, 50mm lens, clean composition, commercial quality.' },
  { id: 'cinematic',    label: 'Cinematic',         suffix: 'Cinematic shot, film grain, anamorphic lens, moody color grading, dramatic lighting.' },
  { id: 'editorial',    label: 'Editorial',         suffix: 'Editorial magazine photography, natural light, high detail, professional retouching.' },
  { id: 'flatlay',      label: 'Flat-lay',          suffix: 'Top-down flat-lay composition, even soft lighting, minimalist styling, on neutral surface.' },
  { id: 'minimal3d',    label: 'Minimal 3D',        suffix: 'Minimal 3D render, soft shadows, pastel palette, clay-like materials, octane render quality.' },
  { id: 'illustration', label: 'Illustration',      suffix: 'Vector illustration, flat design, bold colors, clean linework, modern editorial style.' },
];

interface GeneratedImage { data: string; mimeType: string; }

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [stylePreset, setStylePreset] = useState('none');
  const [model, setModel] = useState<ModelId>('gemini-3-pro-image-preview');
  const [aspectIdx, setAspectIdx] = useState(0);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [numberOfImages, setNumberOfImages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actualCost, setActualCost] = useState<string | null>(null);
  const [actualMs, setActualMs] = useState<number | null>(null);

  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const aspect = ASPECT_PRESETS[aspectIdx];

  const isUltra = model === 'imagen-4.0-ultra-generate-001';
  const maxImages = isUltra ? 1 : 4;
  const effectiveCount = Math.min(numberOfImages, maxImages);

  const perImagePrice =
    selectedModel.supportsResolution && selectedModel.resolutionPricing
      ? selectedModel.resolutionPricing[resolution]
      : selectedModel.basePrice;
  const projectedCost = (perImagePrice * effectiveCount).toFixed(4);

  const isFanOut = selectedModel.family === 'gemini';
  const estTotalSec = isFanOut
    ? selectedModel.estSeconds + (effectiveCount > 1 ? 2 : 0)
    : selectedModel.estSeconds;

  const progressPct = loading ? Math.min(95, Math.round((elapsedSec / estTotalSec) * 100)) : 0;

  useEffect(() => {
    if (loading) {
      const start = Date.now();
      tickerRef.current = setInterval(() => {
        setElapsedSec((Date.now() - start) / 1000);
      }, 100);
    } else if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [loading]);

  useEffect(() => {
    if (isUltra && numberOfImages > 1) setNumberOfImages(1);
  }, [isUltra, numberOfImages]);

  async function generate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setElapsedSec(0);
    setError(null);
    setImages([]);
    setActualCost(null);
    setActualMs(null);

    const stylesuffix = STYLE_PRESETS.find((s) => s.id === stylePreset)?.suffix || '';
    const finalPrompt = stylesuffix ? `${prompt.trim()}\n\n${stylesuffix}` : prompt.trim();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model,
          aspectRatio: aspect.ratio,
          numberOfImages: effectiveCount,
          resolution,
          negativePrompt: negativePrompt.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setImages(json.images);
      setActualCost(json.estimatedCost);
      setActualMs(json.elapsedMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function download(img: GeneratedImage, index: number) {
    const link = document.createElement('a');
    link.href = `data:${img.mimeType};base64,${img.data}`;
    link.download = `gemini-${Date.now()}-${index + 1}.png`;
    link.click();
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>
          Gemini Image Studio
        </h1>
        <p style={{ color: '#737373', marginTop: 4, fontSize: 13 }}>
          Text-to-image via Google Gemini API · Imagen 4 + Nano Banana family
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>
        <div style={panelStyle}>
          <label style={labelStyle}>Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='A white cardboard box of facial towels on a wooden table. Text on box: "fomin". Studio lighting...'
            rows={5}
            style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
          />

          <label style={labelStyle}>
            Negative prompt <span style={hintStyle}>— things to avoid</span>
          </label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="text overlays, watermarks, captions, headers, extra logos, blur"
            rows={2}
            style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
          />

          <label style={labelStyle}>Style preset</label>
          <select
            value={stylePreset}
            onChange={(e) => setStylePreset(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginBottom: 16 }}
          >
            {STYLE_PRESETS.map((s) => (
              <option key={s.id} value={s.id} style={{ background: '#141414' }}>
                {s.label}
              </option>
            ))}
          </select>

          <label style={labelStyle}>Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            style={{ ...inputStyle, width: '100%', marginBottom: 4 }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} style={{ background: '#141414' }}>
                {m.label} — ${m.basePrice.toFixed(3)}/img
              </option>
            ))}
          </select>
          <p style={{ ...hintStyle, marginBottom: 16 }}>{selectedModel.note}</p>

          {selectedModel.supportsResolution && (
            <>
              <label style={labelStyle}>Resolution</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['1K', '2K', '4K'] as Resolution[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    style={{
                      ...chipStyle,
                      flex: 1,
                      padding: '8px 6px',
                      background: resolution === r ? '#2563eb' : '#1f1f1f',
                      borderColor: resolution === r ? '#2563eb' : '#333',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
                      ${selectedModel.resolutionPricing![r].toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <label style={labelStyle}>Aspect ratio</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {ASPECT_PRESETS.map((a, i) => (
              <button
                key={a.ratio}
                onClick={() => setAspectIdx(i)}
                style={{
                  ...chipStyle,
                  textAlign: 'left',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: aspectIdx === i ? '#1e3a8a' : '#1f1f1f',
                  borderColor: aspectIdx === i ? '#2563eb' : '#333',
                }}
              >
                <span>
                  <strong style={{ fontSize: 12 }}>{a.label}</strong>{' '}
                  <span style={{ opacity: 0.6, fontSize: 11 }}>{a.ratio}</span>
                </span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{a.dims}</span>
              </button>
            ))}
          </div>

          {!isUltra && (
            <>
              <label style={labelStyle}>
                Number of images
                {isFanOut && (
                  <span style={hintStyle}> — runs {effectiveCount} parallel calls</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumberOfImages(n)}
                    style={{
                      ...chipStyle,
                      flex: 1,
                      background: numberOfImages === n ? '#2563eb' : '#1f1f1f',
                      borderColor: numberOfImages === n ? '#2563eb' : '#333',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: loading || !prompt.trim() ? '#1f1f1f' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 13,
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !prompt.trim() ? 0.6 : 1,
            }}
          >
            {loading ? `Generating… ${elapsedSec.toFixed(1)}s` : 'Generate'}
          </button>

          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            background: '#0a0a0a',
            border: '1px solid #262626',
            borderRadius: 6,
            fontSize: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#737373' }}>Est. cost</span>
            <span style={{ fontWeight: 600, color: '#e5e5e5' }}>${projectedCost}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#525252', textAlign: 'right' }}>
            {effectiveCount} × ${perImagePrice.toFixed(3)} · ~{estTotalSec}s estimated
          </div>
        </div>

        <div style={{ minHeight: 400 }}>
          {loading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#a3a3a3',
                marginBottom: 6,
              }}>
                <span>
                  Generating with {selectedModel.label}
                  {isFanOut && effectiveCount > 1 ? ` (${effectiveCount} parallel)` : ''}…
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progressPct}% · {elapsedSec.toFixed(1)}s / ~{estTotalSec}s
                </span>
              </div>
              <div style={{
                width: '100%', height: 6, background: '#1f1f1f',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                  transition: 'width 0.2s ease-out',
                }} />
              </div>
              <p style={{ fontSize: 11, color: '#525252', marginTop: 6 }}>
                Note: Gemini API doesn&apos;t stream image progress. Bar shows elapsed time vs estimate.
              </p>
            </div>
          )}

          {error && (
            <div style={{
              padding: 12, background: '#3b1212', border: '1px solid #7f1d1d',
              borderRadius: 6, color: '#fca5a5', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {!loading && images.length === 0 && !error && (
            <div style={placeholderStyle}>
              <p>Output will appear here.</p>
            </div>
          )}

          {images.length > 0 && (
            <>
              <div style={{
                marginBottom: 12, display: 'flex',
                justifyContent: 'space-between', fontSize: 12, color: '#737373',
              }}>
                <span>
                  {images.length} image{images.length > 1 ? 's' : ''} · {selectedModel.label}
                </span>
                <span>${actualCost} · {(actualMs! / 1000).toFixed(1)}s</span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                gap: 12,
              }}>
                {images.map((img, i) => (
                  <div key={i} style={{
                    position: 'relative', background: '#141414',
                    borderRadius: 8, overflow: 'hidden', border: '1px solid #262626',
                  }}>
                    <img
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={`Generated ${i + 1}`}
                      style={{ width: '100%', display: 'block' }}
                    />
                    <button
                      onClick={() => download(img, i)}
                      style={{
                        position: 'absolute', bottom: 8, right: 8,
                        padding: '6px 12px',
                        background: 'rgba(0,0,0,0.75)', color: 'white',
                        border: '1px solid #404040', borderRadius: 4, fontSize: 12,
                      }}
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <footer style={{ marginTop: 40, fontSize: 11, color: '#525252', textAlign: 'center' }}>
        All generated images include a SynthID watermark · API key stays server-side
      </footer>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#141414', border: '1px solid #262626',
  borderRadius: 8, padding: 16, height: 'fit-content',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#a3a3a3',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
};
const hintStyle: React.CSSProperties = {
  fontSize: 11, color: '#737373', textTransform: 'none',
  letterSpacing: 0, fontWeight: 400,
};
const inputStyle: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid #333',
  borderRadius: 6, padding: '8px 10px', color: '#e5e5e5',
  outline: 'none', fontFamily: 'inherit', fontSize: 13,
};
const chipStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #333', borderRadius: 6,
  color: '#e5e5e5', fontSize: 12, background: '#1f1f1f', cursor: 'pointer',
};
const placeholderStyle: React.CSSProperties = {
  height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#141414', border: '1px dashed #333', borderRadius: 8, color: '#525252',
};
