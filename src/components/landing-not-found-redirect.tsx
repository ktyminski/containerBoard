"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type LandingNotFoundRedirectProps = {
  redirectHref: string;
  title: string;
  description: string;
  ctaLabel: string;
  redirectDelayMs?: number;
};

export function LandingNotFoundRedirect({
  redirectHref,
  title,
  description,
  ctaLabel,
  redirectDelayMs = 2400,
}: LandingNotFoundRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(redirectHref);
    }, redirectDelayMs);

    return () => window.clearTimeout(timer);
  }, [redirectDelayMs, redirectHref, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-neutral-100">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">{description}</p>
        <p className="mt-2 text-xs text-neutral-400">Za chwilÄ™ przeniesiemy CiÄ™ do odpowiedniej mapy.</p>
        <div className="mt-5">
          <Link href={redirectHref} className="inline-flex rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-sky-400">
            {ctaLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}



