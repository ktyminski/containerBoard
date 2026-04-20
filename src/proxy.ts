import { NextRequest, NextResponse } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
  resolveLocale,
} from "@/lib/i18n";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PAGE_METHODS = new Set(["GET", "HEAD"]);

function readOriginFromUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function buildSourceList(values: Array<string | null | undefined>): string {
  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ).join(" ");
}

function buildContentSecurityPolicy(): string {
  const mapStyleOrigin =
    readOriginFromUrl(process.env.NEXT_PUBLIC_MAP_STYLE_URL) ?? "https://basemaps.cartocdn.com";
  const scriptSrcDirectives = ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"];
  if (process.env.NODE_ENV === "development") {
    scriptSrcDirectives.push("'unsafe-eval'");
  }

  const connectSrcDirectives = [
    "'self'",
    "https://challenges.cloudflare.com",
    mapStyleOrigin,
    "wss:",
  ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    `script-src ${buildSourceList(scriptSrcDirectives)}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    `connect-src ${buildSourceList(connectSrcDirectives)}`,
    "worker-src 'self' blob:",
  ].join("; ");
}

const LEGACY_STATIC_REDIRECTS = new Map<string, string>([
  ["/praca", "/list"],
  ["/firmy", "/businesses"],
  ["/o-nas", "/about"],
  ["/kontakt", "/contact"],
  ["/polityka-prywatnosci", "/privacy-policy"],
  ["/regulamin", "/terms"],
]);

const LEGACY_PREFIX_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: "/praca/", to: "/list/" },
  { from: "/firmy/", to: "/businesses/" },
];

function resolveMappedPath(
  pathname: string,
  exactMap: Map<string, string>,
  prefixMap: Array<{ from: string; to: string }>,
): string | null {
  const exact = exactMap.get(pathname);
  if (exact) {
    return exact;
  }

  for (const item of prefixMap) {
    if (pathname.startsWith(item.from)) {
      return `${item.to}${pathname.slice(item.from.length)}`;
    }
  }

  return null;
}

function isCrossSiteBrowserRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  return fetchSite === "cross-site";
}

function isTrustedOrigin(request: NextRequest): boolean {
  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  // Allow non-browser clients that may not send Origin/Referer.
  return true;
}

function withSecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isSecureRequest =
    request.nextUrl.protocol === "https:" || forwardedProto?.includes("https");
  if (isSecureRequest) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  }

  return response;
}

function upsertCookieHeader(headerValue: string | null, name: string, value: string): string {
  const nextEntry = `${name}=${value}`;
  if (!headerValue?.trim()) {
    return nextEntry;
  }

  const parts = headerValue
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.toLowerCase().startsWith(`${name.toLowerCase()}=`));

  return [...parts, nextEntry].join("; ");
}

function applyLocaleHeaders(request: NextRequest): {
  locale: string;
  response: NextResponse;
} {
  const locale = resolveLocale(
    request.cookies.get(LOCALE_COOKIE_NAME)?.value ??
      request.headers.get(LOCALE_HEADER_NAME) ??
      request.headers.get("accept-language"),
  );

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER_NAME, locale);
  requestHeaders.set("accept-language", locale);
  requestHeaders.set(
    "cookie",
    upsertCookieHeader(request.headers.get("cookie"), LOCALE_COOKIE_NAME, locale),
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (request.cookies.get(LOCALE_COOKIE_NAME)?.value !== locale) {
    response.cookies.set({
      name: LOCALE_COOKIE_NAME,
      value: locale,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return { locale, response };
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const isApiPath = pathname.startsWith("/api/");
  const isMutatingMethod = MUTATING_METHODS.has(method);
  const { response } = applyLocaleHeaders(request);

  if (isApiPath && isMutatingMethod) {
    if (isCrossSiteBrowserRequest(request) || !isTrustedOrigin(request)) {
      return withSecurityHeaders(
        request,
        NextResponse.json({ error: "CSRF validation failed" }, { status: 403 }),
      );
    }
  }

  if (PAGE_METHODS.has(method) && !isApiPath) {
    const canonicalPath = resolveMappedPath(
      pathname,
      LEGACY_STATIC_REDIRECTS,
      LEGACY_PREFIX_REDIRECTS,
    );
    if (canonicalPath && canonicalPath !== pathname) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = canonicalPath;
      return withSecurityHeaders(request, NextResponse.redirect(redirectUrl, 301));
    }
  }

  return withSecurityHeaders(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
