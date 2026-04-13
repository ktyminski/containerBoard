import { NextResponse } from "next/server";

const CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;
const CODE_ALIASES: Record<string, string> = {
  uk: "gb",
  fx: "fr",
  el: "gr",
};

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

function normalizeFlagCode(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const withoutSvgSuffix = trimmed.endsWith(".svg")
    ? trimmed.slice(0, -4)
    : trimmed;
  const resolved = CODE_ALIASES[withoutSvgSuffix] ?? withoutSvgSuffix;
  return /^[a-z]{2}$/.test(resolved) ? resolved : null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { code } = await context.params;
  const normalizedCode = normalizeFlagCode(code);
  if (!normalizedCode) {
    return new NextResponse(null, { status: 404 });
  }

  const upstreamResponse = await fetch(
    `https://flagcdn.com/${normalizedCode}.svg`,
    {
      cache: "force-cache",
      next: {
        revalidate: CACHE_MAX_AGE_SECONDS,
      },
    },
  );

  if (!upstreamResponse.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const svg = await upstreamResponse.text();
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
    },
  });
}

