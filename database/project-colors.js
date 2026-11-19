export const PROJECT_COLOR_PALETTE = [
  '#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#c2410c', '#dc2626',
  '#db2777', '#4f46e5', '#0f766e', '#9333ea', '#a16207', '#be123c',
  '#0369a1', '#15803d', '#6d28d9', '#b91c1c', '#0e7490', '#a21caf'
];

export function normalizeProjectColor(value, fallback = PROJECT_COLOR_PALETTE[0]) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function componentToHex(value) { return Math.round(value * 255).toString(16).padStart(2, '0'); }

function generatedProjectColor(index) {
  const hue = (Number(index || 0) * 137.508 + 211) % 360;
  const saturation = 0.68; const lightness = 0.42;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60; const second = chroma * (1 - Math.abs(section % 2 - 1));
  const [red, green, blue] = section < 1 ? [chroma, second, 0]
    : section < 2 ? [second, chroma, 0]
      : section < 3 ? [0, chroma, second]
        : section < 4 ? [0, second, chroma]
          : section < 5 ? [second, 0, chroma] : [chroma, 0, second];
  const match = lightness - chroma / 2;
  return `#${componentToHex(red + match)}${componentToHex(green + match)}${componentToHex(blue + match)}`;
}

export function nextProjectColor(existingColors = [], seed = 0) {
  const used = new Set(existingColors.map(value => normalizeProjectColor(value, '')).filter(Boolean));
  const available = PROJECT_COLOR_PALETTE.find(color => !used.has(color));
  if (available) return available;
  for (let offset = 0; offset < 4096; offset += 1) {
    const candidate = generatedProjectColor(Number(seed || 0) + offset);
    if (!used.has(candidate)) return candidate;
  }
  return PROJECT_COLOR_PALETTE[Number(seed || 0) % PROJECT_COLOR_PALETTE.length];
}
