'use client';

import { useState } from 'react';

type ModelId =
  | 'imagen-4.0-fast-generate-001'
  | 'imagen-4.0-generate-001'
  | 'imagen-4.0-ultra-generate-001'
  | 'gemini-2.5-flash-image'
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3-pro-image-preview';

interface ModelOption {
  id: ModelId;
  label: string;
  family: 'imagen' | 'gemini';
  price: number;
  note: string;
}

const MODELS: ModelOption[] = [
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast',     family: 'imagen', price: 0.02,  note: 'Cheapest. Best for high-volume.' },
  { id: 'imagen-4.0-generate-001',      label: 'Imagen 4',          family: 'imagen', price: 0.04,  note: 'Balanced quality and cost.' },
  { id: 'imagen-4.0-ultra-generate-001',label: 'Imagen 4 Ultra',    family: 'imagen', price: 0.06,  note: 'Highest photorealism. 1 image/call.' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2',   family: 'gemini', price: 0.045, note: 'Strong text rendering. 4K capable.' },
  { id: 'gemini-3-pro-image-preview',   label: 'Nano Banana Pro',   family: 'gemini', price: 0.134, note: 'Flagship. Best reasoning + typography.' },
  { id: 'gemini-2.5-flash-image',       label: 'Nano Banana (v1)',  family: 'gemini', price: 0.039, note: 'Original Nano Banana. Stable.' },
];

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;

interface GeneratedImage {
  data: string;
  mimeType: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelId>('imagen-4.0-generate-001');
  const [aspectRatio, setAspectRatio] = useState<typeof ASPECT_RATIOS[number]>('1:1');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const isImagen = selectedModel.family === 'imagen';
  const isUltra = model === 'imagen-4.0-ultra-generate-001';

  async function generate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setImages([]);
    setCost(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspectRatio,
          numberOfImages: isUltra ? 1 : numberOfImages,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setImages(json.images);
      setCost(json.estimatedCost);
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
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>
          Gemini Image Studio
        </h1>
        <p style={{ color: '#737373', marginTop: 4, fontSize: 13 }}>
          Text-to-image via Google Gemini API · Imagen 4 + Nano Banana family
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
        {/* CONTROLS */}
        <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 16 }}>
          <label style={labelStyle}>Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cinematic dusk over a coastal city carved into limestone cliffs..."
            rows={6}
            style={{
              ...inputStyle,
              width: '100%',
              fontFamily: 'inherit',
              marginBottom: 16,
            }}
          />

          <label style={labelStyle}>Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            style={{ ...inputStyle, width: '100%', marginBottom: 4 }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} style={{ background: '#141414' }}>
                {m.label} — ${m.price.toFixed(3)}/img
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: '#737373', marginBottom: 16 }}>
            {selectedModel.note}
          </p>

          <label style={labelStyle}>Aspect ratio</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {ASPECT_RATIOS.map((r) => (
              <button
                key={r}
                onClick={() => setAspectRatio(r)}
                style={{
                  ...chipStyle,
                  background: aspectRatio === r ? '#2563eb' : '#1f1f1f',
                  borderColor: aspectRatio === r ? '#2563eb' : '#333',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {isImagen && !isUltra && (
            <>
              <label style={labelStyle}>Number of images</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumberOfImages(n)}
                    style={{
                      ...chipStyle,
                      background: numberOfImages === n ? '#2563eb' : '#1f1f1f',
                      borderColor: numberOfImages === n ? '#2563eb' : '#333',
                      flex: 1,
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
              padding: '10px 16px',
              background: loading || !prompt.trim() ? '#1f1f1f' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 13,
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !prompt.trim() ? 0.6 : 1,
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>

          {cost && (
            <p style={{ fontSize: 11, color: '#737373', marginTop: 12, textAlign: 'center' }}>
              Estimated cost: ${cost}
            </p>
          )}
        </div>

        {/* OUTPUT */}
        <div style={{ minHeight: 400 }}>
          {error && (
            <div style={{
              padding: 12,
              background: '#3b1212',
              border: '1px solid #7f1d1d',
              borderRadius: 6,
              color: '#fca5a5',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ ...placeholderStyle, color: '#737373' }}>
              Calling Gemini API… (Ultra/Pro models can take ~10s)
            </div>
          )}

          {!loading && images.length === 0 && !error && (
            <div style={placeholderStyle}>
              <p>Output will appear here.</p>
            </div>
          )}

          {images.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {images.map((img, i) => (
                <div key={i} style={{ position: 'relative', background: '#141414', borderRadius: 8, overflow: 'hidden', border: '1px solid #262626' }}>
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={`Generated ${i + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <button
                    onClick={() => download(img, i)}
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      padding: '6px 12px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      border: '1px solid #404040',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <footer style={{ marginTop: 40, fontSize: 11, color: '#525252', textAlign: 'center' }}>
        All generated images include a SynthID watermark · API key stays server-side
      </footer>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: '#a3a3a3',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#e5e5e5',
  outline: 'none',
};

const chipStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#e5e5e5',
  fontSize: 12,
  background: '#1f1f1f',
};

const placeholderStyle: React.CSSProperties = {
  height: 400,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#141414',
  border: '1px dashed #333',
  borderRadius: 8,
  color: '#525252',
};
