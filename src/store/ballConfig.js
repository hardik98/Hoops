// ─── Default & Presets ───────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  baseColor: '#c85a17',
  lineColor: '#1a0800',
  seamPattern: 'classic',
  lighting: 'studio',
};

export const PRESETS = [
  { name: 'Classic',  baseColor: '#c85a17', lineColor: '#1a0800', seamPattern: 'classic', lighting: 'studio' },
  { name: 'Neon Pink',baseColor: '#db2777', lineColor: '#ffffff', seamPattern: 'street',  lighting: 'city'   },
  { name: 'Midnight', baseColor: '#0f1629', lineColor: '#00e5ff', seamPattern: 'tech',    lighting: 'night'  },
  { name: 'Inferno',  baseColor: '#7f1d1d', lineColor: '#fbbf24', seamPattern: 'cross',   lighting: 'dawn'   },
  { name: 'Forest',   baseColor: '#14532d', lineColor: '#86efac', seamPattern: 'street',  lighting: 'city'   },
  { name: 'Ocean',    baseColor: '#1e3a8a', lineColor: '#7dd3fc', seamPattern: 'classic', lighting: 'studio' },
  { name: 'Chrome',   baseColor: '#1f2937', lineColor: '#f59e0b', seamPattern: 'tech',    lighting: 'city'   },
  { name: 'Royal',    baseColor: '#4c1d95', lineColor: '#f0abfc', seamPattern: 'cross',   lighting: 'studio' },
  { name: 'Sunset',   baseColor: '#92400e', lineColor: '#fde68a', seamPattern: 'street',  lighting: 'dawn'   },
];

// ─── Color palettes ──────────────────────────────────────────────────────────
export const BASE_COLORS = [
  '#c85a17', // Classic Leather Orange
  '#f97316', // Neon Electric Orange
  '#eab308', // Cyberpunk Yellow Gold
  '#db2777', // Deep Magenta Pink
  '#f43f5e', // Hot Coral Pink
  '#06b6d4', // Electric Cyan Blue
  '#3b82f6', // Bright Royal Blue
  '#a855f7', // Psychedelic Neon Purple
  '#22c55e', // Neon Lime Green
  '#10b981', // Emerald Mint Green
  '#f8fafc', // Platinum Off-White
  '#1e293b', // Slate Stealth Gray
];

export const LINE_COLORS = [
  '#1a0800', // Flat Dark Brown
  '#ffffff', // Clean White
  '#facc15', // Neon Yellow
  '#22c55e', // Lime Green
  '#00e5ff', // Tech Cyan
  '#f472b6', // soft Pink
  '#a855f7', // Electric Purple
  '#ef4444', // Hot Red
];

// ─── Seam pattern definitions ────────────────────────────────────────────────
// Each key maps to which seam meshes are visible
export const SEAM_VISIBILITY = {
  classic: { eq: true,  v1: true,  v2: true,  c1: true,  c2: true,  c3: true,  c4: true  },
  cross:   { eq: true,  v1: true,  v2: true,  c1: false, c2: false, c3: false, c4: false },
  street:  { eq: true,  v1: false, v2: false, c1: true,  c2: true,  c3: false, c4: false },
  tech:    { eq: false, v1: false, v2: false, c1: true,  c2: true,  c3: true,  c4: true  },
};

// ─── Lighting environment configs ────────────────────────────────────────────
export const LIGHTING_CONFIGS = {
  studio: {
    // Strong white key from top-left → creates the reference-image hot spot
    hemi:    { sky: 0xffffff, ground: 0x080808, intensity: 0.15 },
    main:    { color: 0xffffff, intensity: 5.5 },
    rim:     { color: 0x4488ff, intensity: 3.5 },
    fill:    { color: 0xffeedd, intensity: 0.6 },
    fill2:   { color: 0x001133, intensity: 0.2 },
    fogColor: 0x050505,
  },
  city: {
    hemi:    { sky: 0xdde8f5, ground: 0x181820, intensity: 0.4 },
    main:    { color: 0xeef6ff, intensity: 4.0 },
    rim:     { color: 0x99aacc, intensity: 2.5 },
    fill:    { color: 0xffd080, intensity: 0.7 },
    fill2:   { color: 0x334466, intensity: 0.3 },
    fogColor: 0x0a0f18,
  },
  dawn: {
    hemi:    { sky: 0xff8c40, ground: 0x100604, intensity: 0.4 },
    main:    { color: 0xffe0a0, intensity: 4.8 },
    rim:     { color: 0xff3300, intensity: 4.0 },
    fill:    { color: 0xffdd00, intensity: 1.2 },
    fill2:   { color: 0xff80b0, intensity: 0.8 },
    fogColor: 0x120806,
  },
};


// ─── Apply config to live Three.js refs ──────────────────────────────────────
export function applyConfigToRefs(refs, config) {
  if (!refs) return;
  const { sphereMat, seamMat, seams, hemi, mainLight, rimLight, fillLight, fillLight2, scene } = refs;

  // Base color
  if (sphereMat) sphereMat.color.set(config.baseColor);

  // Line color
  if (seamMat) seamMat.color.set(config.lineColor);

  // Seam pattern visibility
  if (seams) {
    const vis = SEAM_VISIBILITY[config.seamPattern] || SEAM_VISIBILITY.classic;
    Object.entries(vis).forEach(([key, show]) => {
      if (seams[key]) seams[key].visible = show;
    });
  }

  // Lighting
  const lc = LIGHTING_CONFIGS[config.lighting] || LIGHTING_CONFIGS.studio;
  if (hemi) {
    hemi.color.setHex(lc.hemi.sky);
    hemi.groundColor.setHex(lc.hemi.ground);
    hemi.intensity = lc.hemi.intensity;
  }
  if (mainLight) { mainLight.color.setHex(lc.main.color); mainLight.intensity = lc.main.intensity; }
  if (rimLight)  { rimLight.color.setHex(lc.rim.color);   rimLight.intensity  = lc.rim.intensity;  }
  if (fillLight) { fillLight.color.setHex(lc.fill.color);  fillLight.intensity  = lc.fill.intensity;  }
  if (fillLight2){ fillLight2.color.setHex(lc.fill2.color); fillLight2.intensity = lc.fill2.intensity; }
  if (scene?.fog) scene.fog.color.setHex(lc.fogColor);
}

// ─── localStorage ────────────────────────────────────────────────────────────
export function loadConfig() {
  try {
    const s = localStorage.getItem('hoops_config');
    return s ? { ...DEFAULT_CONFIG, ...JSON.parse(s) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

export function saveConfig(config) {
  try { localStorage.setItem('hoops_config', JSON.stringify(config)); } catch {}
}
