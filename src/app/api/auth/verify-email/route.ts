import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import {
  consumeEmailVerificationToken,
  deleteEmailVerificationTokensForUser,
} from "@/lib/email-verification";
import { getUsersCollection } from "@/lib/users";
import { logError } from "@/lib/server-logger";

export const runtime = "nodejs";

function redirectWithError(request: NextRequest, errorCode: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${errorCode}`, request.url));
}

function redirectWithNotice(request: NextRequest, noticeCode: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?notice=${noticeCode}`, request.url));
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
    if (!token || token.length < 20) {
      return redirectWithError(request, "email_verification_failed");
    }

    const tokenDocument = await consumeEmailVerificationToken(token);
    if (!tokenDocument?.userId) {
      return redirectWithError(request, "email_verification_failed");
    }

    const users = await getUsersCollection();
    const now = new Date();
    const updateResult = await users.updateOne(
      { _id: tokenDocument.userId },
      {
        $set: {
          isEmailVerified: true,
          emailVerifiedAt: now,
          updatedAt: now,
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return redirectWithError(request, "email_verification_failed");
    }

    await deleteEmailVerificationTokensForUser(tokenDocument.userId);

    const activeSession = await getSessionFromRequest(request);
    if (activeSession) {
      return NextResponse.redirect(new URL("/settings", request.url));
    }

    return redirectWithNotice(request, "email_verified");
  } catch (error) {
    logError("Unhandled API error", { route: "/api/auth/verify-email", error });
    return redirectWithError(request, "email_verification_failed");
  }
}
