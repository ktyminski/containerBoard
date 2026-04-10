import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PAGE_METHODS = new Set(["GET", "HEAD"]);
function buildContentSecurityPolicy(): string {
  const scriptSrcDirectives = ["'self'", "'unsafe-inline'", "https:"];
  if (process.env.NODE_ENV === "development") {
    scriptSrcDirectives.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    `script-src ${scriptSrcDirectives.join(" ")}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "connect-src 'self' https: wss:",
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

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const isApiPath = pathname.startsWith("/api/");
  const isMutatingMethod = MUTATING_METHODS.has(method);

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

  return withSecurityHeaders(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
