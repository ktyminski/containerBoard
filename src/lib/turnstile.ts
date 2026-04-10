import { getEnv } from "@/lib/env";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export function isTurnstileEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && env.TURNSTILE_SITE_KEY?.trim());
}

export function getTurnstileSiteKey(): string | null {
  if (!isTurnstileEnabled()) {
    return null;
  }
  const env = getEnv();
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  return siteKey && siteKey.length > 0 ? siteKey : null;
}

export function getRequestIp(headers: Headers): string | undefined {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp || undefined;
}

export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string;
}): Promise<{ ok: boolean; errors: string[] }> {
  if (!isTurnstileEnabled()) {
    return { ok: true, errors: [] };
  }

  const token = input.token.trim();
  if (!token) {
    return { ok: false, errors: ["missing-input-response"] };
  }

  const env = getEnv();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: false, errors: ["missing-input-secret"] };
  }

  const payload = new URLSearchParams({
    secret,
    response: token,
  });
  if (input.remoteIp) {
    payload.set("remoteip", input.remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, errors: ["verification-request-failed"] };
    }

    const body = (await response.json()) as TurnstileVerifyResponse;
    return {
      ok: body.success === true,
      errors: body["error-codes"] ?? [],
    };
  } catch {
    return { ok: false, errors: ["verification-request-failed"] };
  }
}
