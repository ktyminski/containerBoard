const COMPANY_FALLBACK_COLORS = [
  "#0f766e",
  "#0369a1",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#15803d",
  "#1d4ed8",
  "#c2410c",
];

export function getCompanyInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function getCompanyFallbackColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return COMPANY_FALLBACK_COLORS[hash % COMPANY_FALLBACK_COLORS.length];
}

export function getCompanyFallbackGradient(color: string): string {
  return `linear-gradient(135deg, ${color}66 0%, ${color}2e 38%, #0f172a 68%, #020617 100%)`;
}
