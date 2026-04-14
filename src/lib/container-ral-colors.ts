import ralToHex from "ral-to-hex";

export const MAX_CONTAINER_RAL_COLORS = 8;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type ContainerRalColor = {
  ral: string;
  hex: string;
  rgb: RgbColor;
};

const RAL_CODE_PATTERN = /^(?:RAL)?\s*([0-9]{4})$/i;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

function splitContainerRalColorTokens(input: string): string[] {
  return input
    .split(/[\n,;|]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function normalizeRalCode(input: string): string | null {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(RAL_CODE_PATTERN);
  if (!match) {
    return null;
  }

  return `RAL ${match[1]}`;
}

function normalizeHexColor(input: string): string | null {
  const normalized = input.trim();
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return null;
  }

  return normalized.toUpperCase();
}

function hexToRgb(hex: string): RgbColor | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }

  const raw = normalized.slice(1);
  const parsed = Number.parseInt(raw, 16);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
  };
}

function resolveRalHexColor(ralCode: string): string | null {
  const digits = ralCode.replace("RAL ", "").trim();
  try {
    const hex = ralToHex(digits);
    if (typeof hex !== "string") {
      return null;
    }
    return normalizeHexColor(hex);
  } catch {
    return null;
  }
}

function parseRgbColorCandidate(input: unknown): RgbColor | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as { r?: unknown; g?: unknown; b?: unknown };
  const channels = [candidate.r, candidate.g, candidate.b];
  if (!channels.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }

  const [r, g, b] = channels.map((value) => Math.trunc(value as number));
  if (
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    return null;
  }

  return { r, g, b };
}

export function parseContainerRalColors(input?: string): {
  colors: ContainerRalColor[];
  invalidCodes: string[];
  tooMany: boolean;
} {
  if (!input || input.trim().length === 0) {
    return { colors: [], invalidCodes: [], tooMany: false };
  }

  const tokens = splitContainerRalColorTokens(input);
  if (tokens.length === 0) {
    return { colors: [], invalidCodes: [], tooMany: false };
  }

  const invalidCodes = new Set<string>();
  const normalizedCodes = new Set<string>();

  for (const token of tokens) {
    const normalizedRalCode = normalizeRalCode(token);
    if (!normalizedRalCode) {
      invalidCodes.add(token);
      continue;
    }
    normalizedCodes.add(normalizedRalCode);
  }

  if (normalizedCodes.size > MAX_CONTAINER_RAL_COLORS) {
    return {
      colors: [],
      invalidCodes: Array.from(invalidCodes),
      tooMany: true,
    };
  }

  const colors: ContainerRalColor[] = [];
  for (const ralCode of normalizedCodes) {
    const hex = resolveRalHexColor(ralCode);
    const rgb = hex ? hexToRgb(hex) : null;
    if (!hex || !rgb) {
      invalidCodes.add(ralCode);
      continue;
    }

    colors.push({
      ral: ralCode,
      hex,
      rgb,
    });
  }

  return {
    colors,
    invalidCodes: Array.from(invalidCodes),
    tooMany: false,
  };
}

export function sanitizeContainerRalColors(input: unknown): ContainerRalColor[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const uniqueByRalCode = new Set<string>();
  const output: ContainerRalColor[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as {
      ral?: unknown;
      hex?: unknown;
      rgb?: unknown;
    };
    const normalizedRalCode =
      typeof candidate.ral === "string"
        ? normalizeRalCode(candidate.ral)
        : null;
    if (!normalizedRalCode || uniqueByRalCode.has(normalizedRalCode)) {
      continue;
    }

    const resolvedHexFromDocument =
      typeof candidate.hex === "string"
        ? normalizeHexColor(candidate.hex)
        : null;
    const resolvedHex = resolvedHexFromDocument ?? resolveRalHexColor(normalizedRalCode);
    if (!resolvedHex) {
      continue;
    }

    const resolvedRgbFromDocument = parseRgbColorCandidate(candidate.rgb);
    const resolvedRgb = resolvedRgbFromDocument ?? hexToRgb(resolvedHex);
    if (!resolvedRgb) {
      continue;
    }

    uniqueByRalCode.add(normalizedRalCode);
    output.push({
      ral: normalizedRalCode,
      hex: resolvedHex,
      rgb: resolvedRgb,
    });
  }

  return output.slice(0, MAX_CONTAINER_RAL_COLORS);
}
