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
type ReferenceRole = 'logo' | 'product' | 'style' | 'palette' | 'other';
type Mode = 'smart' | 'manual';

interface ModelOption {
  id: ModelId;
  label: string;
  family: 'imagen' | 'gemini';
  basePrice: number;
  resolutionPricing?: Record<Resolution, number>;
  supportsNativeMulti: boolean;
  supportsResolution: boolean;
  supportsReferences: boolean;
  estSeconds: number;
  note: string;
}

const MODELS: ModelOption[] = [
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast',     family: 'imagen', basePrice: 0.02,  supportsNativeMulti: true,  supportsResolution: false, supportsReferences: false, estSeconds: 4,  note: 'Cheapest. No reference support.' },
  { id: 'imagen-4.0-generate-001',      label: 'Imagen 4',          family: 'imagen', basePrice: 0.04,  supportsNativeMulti: true,  supportsResolution: false, supportsReferences: false, estSeconds: 6,  note: 'Balanced. No reference support.' },
  { id: 'imagen-4.0-ultra-generate-001',label: 'Imagen 4 Ultra',    family: 'imagen', basePrice: 0.06,  supportsNativeMulti: false, supportsResolution: false, supportsReferences: false, estSeconds: 10, note: 'Top photorealism. No refs. 1/call.' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2',   family: 'gemini', basePrice: 0.045, supportsNativeMulti: false, supportsResolution: false, supportsReferences: true,  estSeconds: 8,  note: 'Up to 14 refs. Strong text rendering.' },
  { id: 'gemini-3-pro-image-preview',   label: 'Nano Banana Pro',   family: 'gemini', basePrice: 0.134, supportsNativeMulti: false, supportsResolution: true,  supportsReferences: true,  estSeconds: 14, note: 'Flagship. Best brand consistency. 1K/2K/4K.',
    resolutionPricing: { '1K': 0.134, '2K': 0.20, '4K': 0.24 } },
  { id: 'gemini-2.5-flash-image',       label: 'Nano Banana (v1)',  family: 'gemini', basePrice: 0.039, supportsNativeMulti: false, supportsResolution: false, supportsReferences: true,  estSeconds: 6,  note: 'Original. Stable.' },
];

const ASPECT_PRESETS = [
  { label: 'Square',    ratio: '1:1',  dims: '1080 × 1080', use: 'IG post' },
  { label: 'Feed',      ratio: '4:5',  dims: '1080 × 1350', use: 'IG / FB feed (portrait)' },
  { label: 'Photo',     ratio: '3:4',  dims: '1080 × 1440', use: 'Portrait photo' },
  { label: 'Story',     ratio: '9:16', dims: '1080 × 1920', use: 'Story / Reel' },
  { label: 'Landscape', ratio: '4:3',  dims: '1440 × 1080', use: 'Classic landscape' },
  { label: 'Wide',      ratio: '16:9', dims: '1920 × 1080', use: 'YouTube / web' },
] as const;

const CATEGORIES = [
  'Skincare & Beauty', 'Personal Care', 'Supplements & Wellness',
  'Beverage', 'Food & Snacks', 'Cosmetics',
  'Apparel & Fashion', 'Home Goods', 'Tech & Electronics',
  'Service / SaaS', 'Other',
];

const TONES = ['Premium', 'Friendly', 'Clinical', 'Playful', 'Minimalist', 'Bold'];
const GOALS = ['Awareness', 'Conversion', 'Education', 'Trust-building'];

// Strategic angle suggestions per category. "auto" = let Claude pick.
// Users can also type a custom angle in the input field.
const ANGLE_SUGGESTIONS: Record<string, string[]> = {
  'Skincare & Beauty': [
    'Problem-solution testimonial (real skin)',
    'Quiet ritual / morning routine',
    'Before-after relief moment',
    'Ingredient hero (close-up texture)',
    'Dermatologist-recommended trust',
  ],
  'Personal Care': [
    'Problem-solution testimonial',
    'Daily-use ritual',
    'Gentle / sensitive-skin reassurance',
    'Family / multi-generation moment',
    'Travel / on-the-go convenience',
  ],
  'Supplements & Wellness': [
    'Outcome lifestyle (energy / focus / calm)',
    'Science-backed credibility',
    'Daily ritual moment',
    'Before-after transformation',
    'Athlete / performance angle',
  ],
  'Beverage': [
    'Refreshment moment (condensation hero)',
    'Social occasion / shared experience',
    'In-hand lifestyle context',
    'Ingredient story',
    'Morning / evening ritual',
  ],
  'Food & Snacks': [
    'Hero close-up (texture, crumbs)',
    'In-hand moment / first bite',
    'Pairing / serving scene',
    'Ingredient sourcing story',
    'Indulgence-without-guilt angle',
  ],
  'Cosmetics': [
    'Confident portrait wearing product',
    'Macro swatch / texture',
    'Before-after look transformation',
    'Vanity ritual aesthetic',
    'Color story',
  ],
  'Apparel & Fashion': [
    'In-motion lifestyle scene',
    'Detail hero (fabric, stitching)',
    'Confident portrait',
    'Versatility / styled multiple ways',
    'Origin / craftsmanship story',
  ],
  'Home Goods': [
    'Lived-in lifestyle scene',
    'Detail hero (material, finish)',
    'Before-after room transformation',
    'Quiet aesthetic moment',
    'Functional in-use demo',
  ],
  'Tech & Electronics': [
    'In-use lifestyle scene',
    'Hands-on hero shot',
    'Sleek product hero (minimal background)',
    'Outcome demonstration',
    'Specs visualization',
  ],
  'Service / SaaS': [
    'Outcome / hero metric',
    'In-context dashboard / UI',
    'Customer testimonial portrait',
    'Before-after workflow',
    'Team / collaboration scene',
  ],
  'Other': [
    'Problem-solution',
    'Lifestyle moment',
    'Hero product shot',
    'Customer testimonial',
    'Outcome / transformation',
  ],
};

const REFERENCE_ROLES: { id: ReferenceRole; label: string }[] = [
  { id: 'logo',    label: 'Logo' },
  { id: 'product', label: 'Product' },
  { id: 'style',   label: 'Style' },
  { id: 'palette', label: 'Palette' },
  { id: 'other',   label: 'Other' },
];

const STYLE_PRESETS = [
  { id: 'none',         label: 'None',              suffix: '' },
  { id: 'product',      label: 'Product photo',     suffix: 'Studio product photography, soft directional lighting, shallow depth of field, 50mm lens, clean composition, commercial quality.' },
  { id: 'cinematic',    label: 'Cinematic',         suffix: 'Cinematic shot, film grain, anamorphic lens, moody color grading, dramatic lighting.' },
  { id: 'editorial',    label: 'Editorial',         suffix: 'Editorial magazine photography, natural light, high detail, professional retouching.' },
  { id: 'flatlay',      label: 'Flat-lay',          suffix: 'Top-down flat-lay composition, even soft lighting, minimalist styling, on neutral surface.' },
  { id: 'minimal3d',    label: 'Minimal 3D',        suffix: 'Minimal 3D render, soft shadows, pastel palette, clay-like materials, octane render quality.' },
  { id: 'illustration', label: 'Illustration',      suffix: 'Vector illustration, flat design, bold colors, clean linework, modern editorial style.' },
];

interface ReferenceImage {
  id: string;
  data: string;
  mimeType: string;
  role: ReferenceRole;
  label: string;
  sizeKB: number;
}

interface GeneratedImage { data: string; mimeType: string; }

interface CreativeBrief {
  headline: string;
  subhead: string;
  angle: string;
  rationale: string;
  imagePrompt: string;
  negativePrompt: string;
  composition: string;
  lighting: string;
  mood: string;
  palette: string;
}

const MAX_REFS = 14;
const MAX_REF_TOTAL_MB = 18;

export default function Home() {
  const [mode, setMode] = useState<Mode>('smart');

  // Smart Mode inputs
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [audience, setAudience] = useState('');
  const [keyBenefit, setKeyBenefit] = useState('');
  const [brandTone, setBrandTone] = useState(TONES[0]);
  const [campaignGoal, setCampaignGoal] = useState(GOALS[0]);
  const [userAngle, setUserAngle] = useState(''); // empty = let Claude auto-pick

  // Manual mode inputs
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [stylePreset, setStylePreset] = useState('none');

  // Shared inputs
  const [model, setModel] = useState<ModelId>('gemini-3-pro-image-preview');
  const [aspectIdx, setAspectIdx] = useState(1); // default to Feed 4:5
  const [resolution, setResolution] = useState<Resolution>('2K');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [references, setReferences] = useState<ReferenceImage[]>([]);

  // Loading & results
  const [briefLoading, setBriefLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [brief, setBrief] = useState<CreativeBrief | null>(null);
  const [briefCost, setBriefCost] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actualCost, setActualCost] = useState<string | null>(null);
  const [actualMs, setActualMs] = useState<number | null>(null);

  const tickerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedModel = MODELS.find((m) => m.id === model)!;
  const aspect = ASPECT_PRESETS[aspectIdx];

  const isUltra = model === 'imagen-4.0-ultra-generate-001';
  const maxImages = isUltra ? 1 : 4;
  const effectiveCount = Math.min(numberOfImages, maxImages);

  const perImagePrice =
    selectedModel.supportsResolution && selectedModel.resolutionPricing
      ? selectedModel.resolutionPricing[resolution]
      : selectedModel.basePrice;
  const projectedImageCost = (perImagePrice * effectiveCount);

  const isFanOut = selectedModel.family === 'gemini';
  const estTotalSec = isFanOut ? selectedModel.estSeconds + (effectiveCount > 1 ? 2 : 0) : selectedModel.estSeconds;
  const loading = briefLoading || imageLoading;
  const progressPct = imageLoading ? Math.min(95, Math.round((elapsedSec / estTotalSec) * 100)) : 0;

  const totalRefMB = references.reduce((s, r) => s + r.sizeKB / 1024, 0);
  const refsBlocked = references.length > 0 && !selectedModel.supportsReferences;

  useEffect(() => {
    if (imageLoading) {
      const start = Date.now();
      tickerRef.current = setInterval(() => setElapsedSec((Date.now() - start) / 1000), 100);
    } else if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [imageLoading]);

  useEffect(() => {
    if (isUltra && numberOfImages > 1) setNumberOfImages(1);
  }, [isUltra, numberOfImages]);

  // Auto-pick Nano Banana Pro if user uploads refs and is on Imagen
  useEffect(() => {
    if (references.length > 0 && !selectedModel.supportsReferences) {
      setModel('gemini-3-pro-image-preview');
    }
  }, [references.length, selectedModel.supportsReferences]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_REFS - references.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const next: ReferenceImage[] = [];
    for (const file of toProcess) {
      if (!file.type.startsWith('image/')) continue;
      const data = await fileToBase64(file);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        data, mimeType: file.type,
        role: guessRole(file.name), label: file.name,
        sizeKB: Math.round(file.size / 1024),
      });
    }
    setReferences((curr) => [...curr, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeReference(id: string) {
    setReferences((curr) => curr.filter((r) => r.id !== id));
  }

  function updateRefRole(id: string, role: ReferenceRole) {
    setReferences((curr) => curr.map((r) => r.id === id ? { ...r, role } : r));
  }

  async function generateSmart() {
    if (!productName.trim() || loading) return;
    setError(null);
    setBrief(null);
    setImages([]);
    setActualCost(null);
    setActualMs(null);
    setBriefCost(null);

    // Stage 1: Get creative brief from Claude
    setBriefLoading(true);
    let generatedBrief: CreativeBrief;
    try {
      const briefRes = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: productName.trim(),
          category,
          audience: audience.trim() || undefined,
          keyBenefit: keyBenefit.trim() || undefined,
          brandTone,
          campaignGoal,
          userAngle: userAngle.trim() || undefined,
          hasReferences: references.length > 0,
        }),
      });
      const briefJson = await briefRes.json();
      if (!briefRes.ok) throw new Error(briefJson.error || 'Brief generation failed');
      generatedBrief = briefJson.brief;
      setBrief(generatedBrief);
      setBriefCost(briefJson.usage?.estimatedCost);
    } catch (e) {
      setError(`Creative brief: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setBriefLoading(false);
      return;
    }
    setBriefLoading(false);

    // Stage 2: Generate the image from the brief
    await generateImageFromPrompt(
      buildSmartPrompt(generatedBrief),
      generatedBrief.negativePrompt
    );
  }

  async function generateManual() {
    if (!prompt.trim() || loading) return;
    setError(null);
    setBrief(null);
    setImages([]);
    setActualCost(null);
    setActualMs(null);
    setBriefCost(null);
    const stylesuffix = STYLE_PRESETS.find((s) => s.id === stylePreset)?.suffix || '';
    const finalPrompt = stylesuffix ? `${prompt.trim()}\n\n${stylesuffix}` : prompt.trim();
    await generateImageFromPrompt(finalPrompt, negativePrompt.trim() || undefined);
  }

  async function generateImageFromPrompt(finalPrompt: string, neg?: string) {
    if (refsBlocked) {
      setError(`${selectedModel.label} doesn't support reference images. Switch to Nano Banana Pro.`);
      return;
    }
    if (totalRefMB > MAX_REF_TOTAL_MB) {
      setError(`References total ${totalRefMB.toFixed(1)}MB — limit is ${MAX_REF_TOTAL_MB}MB.`);
      return;
    }
    setImageLoading(true);
    setElapsedSec(0);
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
          negativePrompt: neg,
          references: references.map((r) => ({
            data: r.data, mimeType: r.mimeType, role: r.role, label: r.label,
          })),
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
      setImageLoading(false);
    }
  }

  function download(img: GeneratedImage, index: number) {
    const link = document.createElement('a');
    link.href = `data:${img.mimeType};base64,${img.data}`;
    link.download = `gemini-${Date.now()}-${index + 1}.png`;
    link.click();
  }

  const canGenerate = mode === 'smart'
    ? productName.trim().length > 0
    : prompt.trim().length > 0;

  return (
    <main style={{ maxWidth: 1320, margin: '0 auto', padding: '32px 24px' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>
            Gemini Image Studio
          </h1>
          <p style={{ color: '#737373', marginTop: 4, fontSize: 13 }}>
            Smart creative direction · Claude writes the brief, Gemini renders the asset
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          background: '#141414',
          border: '1px solid #262626',
          borderRadius: 6,
          padding: 3,
        }}>
          <button
            onClick={() => setMode('smart')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              background: mode === 'smart' ? '#2563eb' : 'transparent',
              color: mode === 'smart' ? 'white' : '#a3a3a3',
            }}
          >
            ✨ Smart Mode
          </button>
          <button
            onClick={() => setMode('manual')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              background: mode === 'manual' ? '#2563eb' : 'transparent',
              color: mode === 'manual' ? 'white' : '#a3a3a3',
            }}
          >
            Manual
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        <div style={panelStyle}>
          {/* === BRAND REFERENCES === */}
          <div style={{
            marginBottom: 16, padding: 12,
            background: '#0f1729',
            border: '1px solid #1e3a8a',
            borderRadius: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0, color: '#93c5fd' }}>
                Brand references
              </label>
              <span style={{ fontSize: 11, color: '#737373' }}>
                {references.length}/{MAX_REFS} · {totalRefMB.toFixed(1)}/{MAX_REF_TOTAL_MB}MB
              </span>
            </div>

            <input
              ref={fileInputRef} type="file"
              accept="image/png,image/jpeg,image/webp" multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={references.length >= MAX_REFS}
              style={{
                width: '100%', padding: '10px',
                background: '#1e3a8a', border: '1px dashed #3b82f6',
                borderRadius: 6, color: '#dbeafe', fontSize: 12,
                cursor: references.length >= MAX_REFS ? 'not-allowed' : 'pointer',
                opacity: references.length >= MAX_REFS ? 0.5 : 1,
              }}
            >
              {references.length === 0
                ? '+ Upload logo, product shot, style ref'
                : `+ Add (${MAX_REFS - references.length} slots left)`}
            </button>

            {references.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {references.map((ref) => (
                  <div key={ref.id} style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: 6, background: '#0a0a0a',
                    border: '1px solid #1f1f1f', borderRadius: 4,
                  }}>
                    <img
                      src={`data:${ref.mimeType};base64,${ref.data}`}
                      alt={ref.label}
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, color: '#e5e5e5',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', marginBottom: 2,
                      }}>
                        {ref.label}
                      </div>
                      <select
                        value={ref.role}
                        onChange={(e) => updateRefRole(ref.id, e.target.value as ReferenceRole)}
                        style={{ ...inputStyle, fontSize: 10, padding: '2px 4px', width: '100%' }}
                      >
                        {REFERENCE_ROLES.map((r) => (
                          <option key={r.id} value={r.id} style={{ background: '#141414' }}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeReference(ref.id)}
                      style={{ background: 'transparent', border: 'none', color: '#737373', fontSize: 16, cursor: 'pointer' }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === MODE-SPECIFIC INPUTS === */}
          {mode === 'smart' ? (
            <>
              <label style={labelStyle}>Product name *</label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Fomin Clean Facial Towels"
                style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: '#141414' }}>{c}</option>
                ))}
              </select>

              <label style={labelStyle}>Target audience</label>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Adults with sensitive skin or eczema"
                style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>Key benefit</label>
              <textarea
                value={keyBenefit}
                onChange={(e) => setKeyBenefit(e.target.value)}
                placeholder="Gentle enough for daily use during flare-ups"
                rows={2}
                style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Tone</label>
                  <select
                    value={brandTone}
                    onChange={(e) => setBrandTone(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t} style={{ background: '#141414' }}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Goal</label>
                  <select
                    value={campaignGoal}
                    onChange={(e) => setCampaignGoal(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    {GOALS.map((g) => (
                      <option key={g} value={g} style={{ background: '#141414' }}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={labelStyle}>
                Strategic angle <span style={hintStyle}>— leave empty for auto-pick</span>
              </label>
              <input
                value={userAngle}
                onChange={(e) => setUserAngle(e.target.value)}
                placeholder={`Auto-pick (Claude chooses) — or type/pick below`}
                list="angle-suggestions"
                style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              />
              <datalist id="angle-suggestions">
                {(ANGLE_SUGGESTIONS[category] || ANGLE_SUGGESTIONS['Other']).map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>

              {/* Quick-pick chips for the current category */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                <button
                  onClick={() => setUserAngle('')}
                  style={{
                    ...chipStyle,
                    padding: '4px 8px',
                    fontSize: 10,
                    background: userAngle === '' ? '#7c3aed' : '#1f1f1f',
                    borderColor: userAngle === '' ? '#7c3aed' : '#333',
                  }}
                >
                  ✨ Auto-pick
                </button>
                {(ANGLE_SUGGESTIONS[category] || ANGLE_SUGGESTIONS['Other']).map((a) => (
                  <button
                    key={a}
                    onClick={() => setUserAngle(a)}
                    style={{
                      ...chipStyle,
                      padding: '4px 8px',
                      fontSize: 10,
                      background: userAngle === a ? '#2563eb' : '#1f1f1f',
                      borderColor: userAngle === a ? '#2563eb' : '#333',
                      maxWidth: '100%',
                      textAlign: 'left',
                    }}
                    title={a}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label style={labelStyle}>Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A scene description..."
                rows={5}
                style={{ ...inputStyle, width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>
                Negative prompt <span style={hintStyle}>— things to avoid</span>
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="text overlays, watermarks, captions"
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
                  <option key={s.id} value={s.id} style={{ background: '#141414' }}>{s.label}</option>
                ))}
              </select>
            </>
          )}

          {/* === SHARED CONTROLS === */}
          <label style={labelStyle}>Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            style={{ ...inputStyle, width: '100%', marginBottom: 4 }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} style={{ background: '#141414' }}>
                {m.label} {m.supportsReferences ? '🖼' : ''} — ${m.basePrice.toFixed(3)}/img
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
                      ...chipStyle, flex: 1, padding: '8px 6px',
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
                  ...chipStyle, textAlign: 'left', padding: '8px 12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
                {isFanOut && <span style={hintStyle}> — {effectiveCount} parallel</span>}
              </label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumberOfImages(n)}
                    style={{
                      ...chipStyle, flex: 1,
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
            onClick={mode === 'smart' ? generateSmart : generateManual}
            disabled={loading || !canGenerate || refsBlocked}
            style={{
              width: '100%', padding: '12px 16px',
              background: loading || !canGenerate || refsBlocked ? '#1f1f1f' : '#2563eb',
              color: 'white', border: 'none', borderRadius: 6,
              fontWeight: 500, fontSize: 13,
              cursor: loading || !canGenerate || refsBlocked ? 'not-allowed' : 'pointer',
              opacity: loading || !canGenerate || refsBlocked ? 0.6 : 1,
            }}
          >
            {briefLoading ? '✨ Writing creative brief…' :
              imageLoading ? `Generating… ${elapsedSec.toFixed(1)}s` :
              mode === 'smart' ? '✨ Generate Smart Asset' : 'Generate'}
          </button>

          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: '#0a0a0a', border: '1px solid #262626',
            borderRadius: 6, fontSize: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#737373' }}>Est. cost</span>
            <span style={{ fontWeight: 600, color: '#e5e5e5' }}>
              ${(projectedImageCost + (mode === 'smart' ? 0.003 : 0)).toFixed(4)}
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#525252', textAlign: 'right' }}>
            {mode === 'smart' && '~$0.003 brief + '}
            {effectiveCount} × ${perImagePrice.toFixed(3)} · ~{estTotalSec}s
          </div>
        </div>

        <div style={{ minHeight: 400 }}>
          {/* Brief loading state */}
          {briefLoading && (
            <div style={{
              padding: 16, background: '#1e1b4b',
              border: '1px solid #4338ca', borderRadius: 6,
              marginBottom: 16,
            }}>
              <p style={{ fontSize: 13, color: '#c7d2fe' }}>
                ✨ Claude is writing your creative brief — picking the angle, headline, and visual direction…
              </p>
            </div>
          )}

          {/* Creative brief display */}
          {brief && (
            <div style={{
              padding: 16, background: '#0f0f1f',
              border: '1px solid #4338ca', borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  Creative Brief by Claude
                </span>
                <span style={{ fontSize: 11, color: '#525252' }}>
                  {brief.angle} · ${briefCost}
                </span>
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e5e5e5', marginBottom: 6, lineHeight: 1.2 }}>
                {brief.headline}
              </h2>
              <p style={{ fontSize: 14, color: '#a3a3a3', marginBottom: 12, lineHeight: 1.4 }}>
                {brief.subhead}
              </p>

              <p style={{ fontSize: 12, color: '#737373', fontStyle: 'italic', marginBottom: 12 }}>
                {brief.rationale}
              </p>

              <details style={{ fontSize: 12, color: '#a3a3a3' }}>
                <summary style={{ cursor: 'pointer', color: '#60a5fa', fontSize: 11 }}>
                  View image direction
                </summary>
                <div style={{ marginTop: 8, padding: 10, background: '#0a0a0a', borderRadius: 4 }}>
                  <p style={{ marginBottom: 8 }}><strong style={{ color: '#e5e5e5' }}>Composition:</strong> {brief.composition}</p>
                  <p style={{ marginBottom: 8 }}><strong style={{ color: '#e5e5e5' }}>Lighting:</strong> {brief.lighting}</p>
                  <p style={{ marginBottom: 8 }}><strong style={{ color: '#e5e5e5' }}>Mood:</strong> {brief.mood}</p>
                  <p style={{ marginBottom: 8 }}><strong style={{ color: '#e5e5e5' }}>Palette:</strong> {brief.palette}</p>
                  <p style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #1f1f1f' }}>
                    <strong style={{ color: '#e5e5e5' }}>Image prompt:</strong> {brief.imagePrompt}
                  </p>
                </div>
              </details>
            </div>
          )}

          {/* Image progress */}
          {imageLoading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a3a3a3', marginBottom: 6 }}>
                <span>Generating image with {selectedModel.label}…</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {progressPct}% · {elapsedSec.toFixed(1)}s / ~{estTotalSec}s
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#1f1f1f', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${progressPct}%`, height: '100%',
                  background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                  transition: 'width 0.2s ease-out',
                }} />
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: 12, background: '#3b1212',
              border: '1px solid #7f1d1d', borderRadius: 6,
              color: '#fca5a5', fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {!loading && images.length === 0 && !error && !brief && (
            <div style={placeholderStyle}>
              <div style={{ textAlign: 'center', color: '#525252', padding: 20 }}>
                {mode === 'smart' ? (
                  <>
                    <p style={{ marginBottom: 8, fontSize: 14, color: '#a3a3a3' }}>✨ Smart Mode</p>
                    <p style={{ marginBottom: 6 }}>Fill in product name + category, click Generate.</p>
                    <p style={{ fontSize: 11 }}>
                      {userAngle.trim()
                        ? `Claude will execute your "${userAngle}" angle.`
                        : 'Claude will auto-pick the angle — or pick one yourself from the suggestions.'}
                    </p>
                  </>
                ) : (
                  <p>Write a prompt and click Generate.</p>
                )}
              </div>
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
                  {references.length > 0 && ` · ${references.length} refs`}
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
        Claude writes creative briefs · Gemini renders the image · All output carries SynthID watermark
      </footer>
    </main>
  );
}

// === HELPERS ===

function buildSmartPrompt(brief: CreativeBrief): string {
  // Stitch Claude's structured brief into a single prompt for Gemini.
  // The headline goes in quotes so the model treats it as exact text to render.
  return [
    brief.imagePrompt,
    '',
    `Render the headline exactly as written: "${brief.headline}"`,
    brief.subhead ? `Render the subhead exactly as written: "${brief.subhead}"` : '',
    '',
    `Composition: ${brief.composition}.`,
    `Lighting: ${brief.lighting}.`,
    `Mood: ${brief.mood}.`,
    `Palette: ${brief.palette}.`,
  ].filter(Boolean).join('\n');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function guessRole(filename: string): ReferenceRole {
  const f = filename.toLowerCase();
  if (f.includes('logo') || f.includes('mark') || f.includes('wordmark')) return 'logo';
  if (f.includes('product') || f.includes('package') || f.includes('box') || f.includes('packaging')) return 'product';
  if (f.includes('palette') || f.includes('color') || f.includes('swatch')) return 'palette';
  if (f.includes('style') || f.includes('mood') || f.includes('inspo')) return 'style';
  return 'product';
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
