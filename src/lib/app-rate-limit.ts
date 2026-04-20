import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { enforceRateLimitOrResponse } from "@/lib/request-rate-limit";

type RateLimitResult = Promise<NextResponse | null>;

type PublicReadRateLimitInput = {
  request: NextRequest;
  scope: string;
  limit: number;
  windowMs?: number;
};

type AuthenticatedRateLimitInput = {
  request: NextRequest;
  scope: string;
  userId: string;
  ipLimit: number;
  userLimit: number;
  windowMs?: number;
};

const DEFAULT_WINDOW_MS = 60_000;

export function enforcePublicReadRateLimitOrResponse(
  input: PublicReadRateLimitInput,
): RateLimitResult {
  return enforceRateLimitOrResponse({
    request: input.request,
    scope: `${input.scope}:ip`,
    limit: input.limit,
    windowMs: input.windowMs ?? DEFAULT_WINDOW_MS,
  });
}

export async function enforceAuthenticatedRateLimitOrResponse(
  input: AuthenticatedRateLimitInput,
): RateLimitResult {
  const ipRateLimitResponse = await enforceRateLimitOrResponse({
    request: input.request,
    scope: `${input.scope}:ip`,
    limit: input.ipLimit,
    windowMs: input.windowMs ?? DEFAULT_WINDOW_MS,
    onError: "block",
  });
  if (ipRateLimitResponse) {
    return ipRateLimitResponse;
  }

  return enforceRateLimitOrResponse({
    request: input.request,
    scope: `${input.scope}:user`,
    limit: input.userLimit,
    windowMs: input.windowMs ?? DEFAULT_WINDOW_MS,
    identity: input.userId,
    onError: "block",
  });
}
