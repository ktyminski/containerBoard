import Link from "next/link";
import Image from "next/image";
import {
  withLang,
  type AppLocale,
  type AppMessages,
} from "@/lib/i18n";

type HomeSectionsProps = {
  locale: AppLocale;
  home: AppMessages["home"];
};

type TrustedLogo = {
  src: string;
  name: string;
};

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0"
    >
      <path d="M4.5 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="m10.5 6.5 4 3.5-4 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeHeroSection({
  locale,
  home,
}: HomeSectionsProps) {
  return (
    <section className="relative overflow-hidden border-b border-slate-800 bg-slate-950 px-4 pb-14 pt-12 sm:px-6 sm:pb-16 sm:pt-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        aria-hidden="true"
      >
        <Image
          src="/photos/photo.webp"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/15 via-slate-950/55 to-slate-950/95"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-8 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -right-20 top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="ml-auto max-w-4xl text-right">
          <p className="text-xs uppercase tracking-[0.22em] text-sky-300/90">{home.heroEyebrow}</p>
          <h1 className="mt-4 ml-auto max-w-4xl text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl lg:text-5xl">
            {home.heroTitle}
          </h1>
          <p className="mt-4 ml-auto max-w-3xl text-sm text-slate-300 sm:text-base">
            {home.heroSubtitle}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Link
              href={withLang("/maps", locale)}
              className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
            >
              <span>{home.heroPrimaryCta}</span>
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeWhatSection({
  locale,
  home,
}: HomeSectionsProps) {
  return (
    <section className="relative border-b border-slate-800 bg-slate-950 px-4 py-12 sm:px-6">
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-sky-200">{home.whatEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-100 sm:text-3xl">{home.whatTitle}</h2>
          <p className="mt-3 text-sm text-slate-200/90 sm:text-base">{home.whatSubtitle}</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-5xl gap-5 lg:grid-cols-2">
          <article className="relative mx-auto w-full max-w-xl rounded-2xl border border-sky-600/50 bg-slate-900/85 p-6 shadow-[0_24px_60px_-40px_rgba(56,189,248,0.65)]">
            <div className="relative text-center">
              <h3 className="text-2xl font-semibold text-slate-100">{home.whatPathSearchTitle}</h3>
              <p className="mt-3 text-sm text-slate-300">{home.whatPathSearchText}</p>
              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <Link
                    href={withLang("/maps/announcements", locale)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-sky-500/55 bg-sky-500/10 px-4 py-3 font-medium text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                  >
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/25 text-xs text-sky-200">🔎</span>
                    <span>{home.whatSearchPointOne}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={withLang("/maps/companies", locale)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-sky-500/55 bg-sky-500/10 px-4 py-3 font-medium text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                  >
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/25 text-xs text-sky-200">🔎</span>
                    <span>{home.whatSearchPointTwo}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={withLang("/maps/lead-requests", locale)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-sky-500/55 bg-sky-500/10 px-4 py-3 font-medium text-sky-100 transition hover:border-sky-300 hover:bg-sky-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                  >
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/25 text-xs text-sky-200">🔎</span>
                    <span>{home.whatSearchPointThree}</span>
                  </Link>
                </li>
              </ul>
            </div>
          </article>

          <article className="relative mx-auto w-full max-w-xl rounded-2xl border border-emerald-600/50 bg-slate-900/85 p-6 shadow-[0_24px_60px_-40px_rgba(52,211,153,0.65)]">
            <div className="relative text-center">
              <h3 className="text-2xl font-semibold text-slate-100">{home.whatPathOfferTitle}</h3>
              <p className="mt-3 text-sm text-slate-300">{home.whatPathOfferText}</p>
              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <Link
                    href={withLang("/companies/new", locale)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500/55 bg-emerald-500/10 px-4 py-3 font-medium text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-200">+</span>
                    <span>{home.whatOfferPointOne}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={withLang("/offers/new", locale)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500/55 bg-emerald-500/10 px-4 py-3 font-medium text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-200">+</span>
                    <span>{home.whatOfferPointTwo}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href={withLang("/announcements/new", locale)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500/55 bg-emerald-500/10 px-4 py-3 font-medium text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-200">+</span>
                    <span>{home.whatOfferPointThree}</span>
                  </Link>
                </li>
              </ul>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function HomeMapPreviewSection({
  locale,
  home,
}: HomeSectionsProps) {
  return (
    <section id="map-preview" className="border-b border-slate-800 bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{home.previewEyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">{home.previewTitle}</h2>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-[0_20px_60px_-30px_rgba(14,165,233,0.45)]">
          <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <Link
              href={withLang("/maps/companies", locale)}
              className="group relative block"
              aria-label={home.previewImageAlt}
            >
              <Image
                src="/photos/landing-map-preview.webp"
                alt={home.previewImageAlt}
                width={924}
                height={593}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 hidden w-36 bg-gradient-to-r from-transparent to-slate-950/95 lg:block"
                aria-hidden="true"
              />
            </Link>

            <div className="relative flex flex-col justify-center gap-4 bg-slate-950/95 p-5 sm:p-8">
              <h3 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                {home.previewPanelTitle}
              </h3>
              <p className="text-sm text-slate-300 sm:text-base">{home.previewPanelText}</p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>{home.previewPanelPointOne}</li>
                <li>{home.previewPanelPointTwo}</li>
                <li>{home.previewPanelPointThree}</li>
              </ul>
              <div>
                <Link
                  href={withLang("/maps/companies", locale)}
                  className="inline-flex items-center gap-2 rounded-md border border-sky-700 px-4 py-2 text-sm text-sky-200 hover:border-sky-500"
                >
                  <span>{home.previewOpenMap}</span>
                  <ArrowRightIcon />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeJoinSection({
  locale,
  home,
}: HomeSectionsProps) {
  return (
    <section className="border-b border-slate-800 bg-slate-950 px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-2xl border border-emerald-700/40 bg-slate-950 p-6 shadow-[0_24px_70px_-40px_rgba(16,185,129,0.55)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">{home.joinEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-100 sm:text-3xl">
            {home.joinTitle}
          </h2>
          <p className="mt-3 text-sm text-slate-200/90 sm:text-base">{home.joinSubtitle}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-200/95 marker:text-emerald-300 sm:text-base">
            <li>{home.joinPointOne}</li>
            <li>{home.joinPointTwo}</li>
            <li>{home.joinPointThree}</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={withLang("/companies/new", locale)}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-300"
            >
              <span>{home.joinPrimaryCta}</span>
              <span aria-hidden="true">+</span>
            </Link>
            <Link
              href={withLang("/contact", locale)}
              className="rounded-md border border-emerald-600/70 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-400"
            >
              {home.joinSecondaryCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeTrustedSection({
  home,
  logos,
}: {
  home: AppMessages["home"];
  logos: TrustedLogo[];
}) {
  if (logos.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-slate-800 bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">{home.trustedEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-100 sm:text-3xl">{home.trustedTitle}</h2>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
          {logos.map((logo) => (
            <div key={logo.src} className="flex min-h-16 items-center justify-center px-1 py-1">
              <Image
                src={logo.src}
                alt={`${logo.name} logo`}
                width={180}
                height={70}
                className="h-10 w-auto max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeStepsFaqSection({ home }: Pick<HomeSectionsProps, "home">) {
  return (
    <section className="border-b border-slate-800 bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{home.stepsEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-100">{home.stepsTitle}</h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-300">
            <li className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-slate-100">{home.stepOneTitle}</p>
              <p className="mt-1">{home.stepOneText}</p>
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-slate-100">{home.stepTwoTitle}</p>
              <p className="mt-1">{home.stepTwoText}</p>
            </li>
            <li className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-slate-100">{home.stepThreeTitle}</p>
              <p className="mt-1">{home.stepThreeText}</p>
            </li>
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{home.faqEyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-100">{home.faqTitle}</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-slate-100">{home.faqOneQuestion}</p>
              <p className="mt-1 text-slate-300">{home.faqOneAnswer}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-slate-100">{home.faqTwoQuestion}</p>
              <p className="mt-1 text-slate-300">{home.faqTwoAnswer}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <p className="font-medium text-slate-100">{home.faqThreeQuestion}</p>
              <p className="mt-1 text-slate-300">{home.faqThreeAnswer}</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function HomeFinalSection({
  locale,
  home,
}: HomeSectionsProps) {
  return (
    <section className="bg-slate-950 px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center sm:p-8">
        <h2 className="text-2xl font-semibold text-slate-100 sm:text-3xl">{home.finalTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">{home.finalSubtitle}</p>
        <div className="mt-6">
          <Link
            href={withLang("/maps", locale)}
            className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
          >
            <span>{home.finalCta}</span>
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
