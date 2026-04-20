import { NextResponse } from "next/server";
import { LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { locale?: string | null }
    | null;
  const locale = resolveLocale(payload?.locale);

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set({
    name: LOCALE_COOKIE_NAME,
    value: locale,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
