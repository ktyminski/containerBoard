import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ContainerPhotoWithPlaceholder } from "@/components/container-photo-with-placeholder";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import {
  buildContainerListingsFilter,
  ensureContainerListingsIndexes,
  expireContainerListingsIfNeeded,
  getContainerListingsCollection,
  mapContainerListingToItem,
  type ContainerListingItem,
} from "@/lib/container-listings";
import {
  CONTAINER_CONDITION_LABEL,
  PRICE_CURRENCY_LABEL,
  getContainerShortLabel,
} from "@/lib/container-listing-types";
import {
  formatTemplate,
  getMessages,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  withLang,
} from "@/lib/i18n";
import { logError } from "@/lib/server-logger";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const landing = getMessages(locale).landingPage;

  return {
    title: landing.metaTitle,
    description: landing.metaDescription,
  };
}

async function getLatestListings(limit = 6): Promise<ContainerListingItem[]> {
  try {
    await ensureContainerListingsIndexes();
    await expireContainerListingsIfNeeded();

    const now = new Date();
    const listings = await getContainerListingsCollection();
    const filter = {
      ...buildContainerListingsFilter({
        includeOnlyPublic: true,
        now,
      }),
      type: { $in: ["sell", "rent"] as const },
    };

    const rows = await listings.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return rows.map(mapContainerListingToItem);
  } catch (error) {
    logError("Failed to load latest listings on landing page", { error });
    return [];
  }
}

function getLandingCardPlaceholderSrc(item: ContainerListingItem): string {
  if (item.container.size === 20) {
    return "/placeholders/containers/container-20.svg";
  }
  if (item.container.size === 40) {
    return "/placeholders/containers/container-40.svg";
  }
  if (item.container.size === 45) {
    return "/placeholders/containers/container-45.svg";
  }
  return "/placeholders/containers/container-unknown.svg";
}

function getLandingCardImageSrc(item: ContainerListingItem): string {
  const firstPhotoUrl = item.photoUrls?.find((value) => {
    const trimmed = value?.trim();
    return Boolean(trimmed);
  });

  return firstPhotoUrl ?? getLandingCardPlaceholderSrc(item);
}

function getLandingCardPriceLabel(item: ContainerListingItem, locale: string): string | null {
  if (
    item.pricing?.original.amount !== null &&
    typeof item.pricing?.original.amount === "number" &&
    Number.isFinite(item.pricing.original.amount) &&
    item.pricing.original.currency
  ) {
    return `${Math.round(item.pricing.original.amount).toLocaleString(locale)} ${
      PRICE_CURRENCY_LABEL[item.pricing.original.currency]
    }`;
  }

  if (typeof item.priceAmount === "number" && Number.isFinite(item.priceAmount)) {
    return `${Math.round(item.priceAmount).toLocaleString(locale)} PLN`;
  }

  return null;
}

export default async function LandingPage() {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const messages = getMessages(locale);
  const landing = messages.landingPage;
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const latestListings = await getLatestListings(6);
  const nextCreate = encodeURIComponent("/containers/new");

  const primaryCtaClass =
    "inline-flex items-center justify-center rounded-md bg-[linear-gradient(135deg,#c026d3_0%,#db2777_50%,#ea580c_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_44px_-26px_rgba(192,38,211,0.7)] transition duration-200 hover:shadow-[0_28px_54px_-28px_rgba(192,38,211,0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c026d3]";
  const secondaryCtaClass =
    "inline-flex items-center justify-center rounded-md border border-[#1d5ea8] bg-[#103b74] px-5 py-3 text-sm font-semibold text-[#f6fbff] transition duration-200 hover:border-[#2f76c7] hover:bg-[#16498d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d5ea8]";
  const tertiaryCtaClass =
    "inline-flex items-center justify-center rounded-md border border-[#c7d4e5] bg-white px-5 py-3 text-sm font-semibold text-[#153256] transition duration-200 hover:border-[#9fb5d4] hover:bg-[#f7fbff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7aa2d6]";
  const heroCardTitleParts = landing.heroCardTitle.split("ContainerBoard");
  const heroCardTitlePrefix = heroCardTitleParts[0] ?? "";
  const heroCardTitleSuffix = heroCardTitleParts.slice(1).join("ContainerBoard");
  const heroCardTitleHasBrand = heroCardTitleParts.length > 1;
  const normalizedHeroCardTitleSuffix = heroCardTitleSuffix.trim();
  const shouldAppendHeroCardQuestionMark =
    heroCardTitleHasBrand &&
    !normalizedHeroCardTitleSuffix.endsWith("?") &&
    !normalizedHeroCardTitleSuffix.endsWith("!");

  return (
    <main className="w-full bg-neutral-200 text-[#10233f]">
      <section className="relative overflow-hidden border-b border-neutral-300">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/photos/background.webp')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#061933]/88" aria-hidden="true" />

        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl content-center gap-6 px-4 py-12 supports-[height:100dvh]:min-h-[calc(100dvh-4rem)] sm:min-h-[34rem] sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.8fr)] lg:content-normal lg:items-center lg:gap-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center lg:ml-auto lg:mr-0 lg:text-right">
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:mx-0 lg:text-6xl">
              {landing.heroTitle}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#e2edf9] sm:text-lg lg:ml-auto lg:mr-0">
              {landing.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-end">
              <Link href={withLang("/list", locale)} className={primaryCtaClass}>
                {landing.browseCta}
              </Link>
              <Link
                href={
                  isLoggedIn
                    ? withLang("/containers/new", locale)
                    : withLang(`/login?next=${nextCreate}`, locale)
                }
                className={secondaryCtaClass}
              >
                {landing.createCta}
              </Link>
            </div>
          </div>

          <div className="self-start rounded-md border border-white/12 bg-[rgba(7,24,48,0.84)] p-4 text-center text-white shadow-[0_30px_60px_-42px_rgba(15,23,42,0.75)] backdrop-blur-sm sm:p-5 lg:p-6 lg:text-left">
            {landing.heroCardEyebrow ? (
              <p className="text-xs font-semibold tracking-[0.22em] text-[#8bd4ff] uppercase">
                {landing.heroCardEyebrow}
              </p>
            ) : null}
            <h2 className="mt-2 text-lg font-semibold sm:text-2xl">
              {heroCardTitleHasBrand ? (
                <>
                  {heroCardTitlePrefix}
                  <span className="text-[#e2efff]">Container</span>
                  <span className="text-[#38bdf8]">Board</span>
                  {heroCardTitleSuffix}
                  {shouldAppendHeroCardQuestionMark ? "?" : null}
                </>
              ) : (
                landing.heroCardTitle
              )}
            </h2>
            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:hidden">
              {landing.heroValuePoints.map((point) => (
                <div
                  key={point.title}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-[#e9f2fb] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                >
                  <span>{point.title}</span>
                  {point.icon === "bolt" ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0 text-[#facc15]"
                      fill="currentColor"
                    >
                      <path d="M11.25 1.5a.75.75 0 0 0-.69.46L6.7 11.1a.75.75 0 0 0 .69 1.04h2.56l-1.18 5.68a.75.75 0 0 0 1.37.53l4.96-8.4a.75.75 0 0 0-.65-1.13h-2.9l1.38-6.29a.75.75 0 0 0-.73-.91Z" />
                    </svg>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 hidden gap-2.5 lg:grid">
              {landing.heroValuePoints.map((point) => (
                <article
                  key={point.title}
                  className="rounded-md border border-white/10 bg-white/8 p-3"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span>{point.title}</span>
                    {point.icon === "bolt" ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        className="h-4 w-4 shrink-0 text-[#facc15]"
                        fill="currentColor"
                      >
                        <path d="M11.25 1.5a.75.75 0 0 0-.69.46L6.7 11.1a.75.75 0 0 0 .69 1.04h2.56l-1.18 5.68a.75.75 0 0 0 1.37.53l4.96-8.4a.75.75 0 0 0-.65-1.13h-2.9l1.38-6.29a.75.75 0 0 0-.73-.91Z" />
                      </svg>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#d9e7f7]">{point.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center sm:hidden">
          <div className="inline-flex items-center justify-center rounded-md border border-white/14 bg-white/10 px-3 py-2 text-white/90 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.85)] backdrop-blur-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 animate-bounce"
              fill="none"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-neutral-200 py-14 sm:py-16">
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#103b74] uppercase">
                {landing.latestEyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[#10233f] sm:text-4xl">
                {landing.latestTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#4e6178] sm:text-base">
                {landing.latestDescription}
              </p>
            </div>
            <Link href={withLang("/list", locale)} className={tertiaryCtaClass}>
              {landing.latestCta}
            </Link>
          </div>

          {latestListings.length > 0 ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {latestListings.map((item) => {
                const priceLabel = getLandingCardPriceLabel(item, locale);
                const createdAtLabel = formatTemplate(landing.latestAddedTemplate, {
                  date: new Date(item.createdAt).toLocaleDateString(locale),
                });

                return (
                  <li key={item.id}>
                    <Link
                      href={withLang(`/containers/${item.id}`, locale)}
                      className="group flex h-full items-start gap-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60"
                    >
                      <div className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 sm:h-28 sm:w-28">
                        <ContainerPhotoWithPlaceholder
                          src={getLandingCardImageSrc(item)}
                          alt=""
                          fill
                          className={
                            item.photoUrls && item.photoUrls.length > 0
                              ? "object-cover"
                              : "object-contain p-1"
                          }
                          sizes="96px"
                        />
                      </div>

                      <div className="min-w-0 flex flex-1 flex-col justify-between">
                        <div className="min-w-0">
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base font-semibold text-neutral-900 sm:text-lg">
                                {getContainerShortLabel(item.container)}
                              </h3>
                              <p className="mt-1 truncate text-sm text-neutral-600">
                                {item.locationCity}, {item.locationCountry}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {landing.latestConditionLabel}:{" "}
                                {CONTAINER_CONDITION_LABEL[item.container.condition]}
                              </p>
                            </div>

                            {priceLabel ? (
                              <div className="min-w-0 max-w-[8.5rem] shrink-0 text-right sm:max-w-[11rem]">
                                <p className="break-words text-sm font-bold leading-tight text-neutral-900 sm:text-lg">
                                  {priceLabel}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-1 text-sm text-neutral-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
                          <p>
                            {landing.latestQuantityLabel}:{" "}
                            <span className="font-medium text-neutral-900">{item.quantity}</span>
                          </p>
                          <p className="text-neutral-500">{createdAtLabel}</p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-md border border-[#d4deeb] bg-white p-8 text-center shadow-[0_24px_40px_-34px_rgba(15,23,42,0.45)]">
              <p className="mx-auto max-w-2xl text-sm leading-6 text-[#4e6178] sm:text-base">
                {landing.latestEmptyText}
              </p>
              <div className="mt-5">
                <Link
                  href={
                    isLoggedIn
                      ? withLang("/containers/new", locale)
                      : withLang(`/login?next=${nextCreate}`, locale)
                  }
                  className={secondaryCtaClass}
                >
                  {landing.latestEmptyCta}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-neutral-100 py-14 sm:py-16">
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.24em] text-[#103b74] uppercase">
              {landing.workflowEyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#10233f] sm:text-4xl">
              {landing.workflowTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#4e6178] sm:text-base">
              {landing.workflowDescription}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {landing.workflowSteps.map((step) => (
              <article
                key={step.step}
                className="rounded-md border border-neutral-300 bg-white/90 p-6 shadow-[0_24px_40px_-34px_rgba(15,23,42,0.35)]"
              >
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-[#103b74] px-2 text-sm font-semibold text-white">
                  {step.step}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-[#10233f]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4e6178]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-neutral-200 py-14 sm:py-16">
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.24em] text-[#103b74] uppercase">
              {landing.conciergeEyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[#10233f] sm:text-4xl">
              {landing.conciergeTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#4e6178] sm:text-base">
              {landing.conciergeDescription}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {landing.conciergeServices.map((service) => (
              <article
                key={service.title}
                className="rounded-md border border-neutral-300 bg-white p-6 shadow-[0_24px_40px_-34px_rgba(15,23,42,0.35)]"
              >
                <h3 className="text-xl font-semibold text-[#10233f]">{service.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4e6178]">{service.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={withLang("/contact", locale)} className={secondaryCtaClass}>
              {landing.conciergeCta}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-neutral-100 py-14 sm:py-16">
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="rounded-md border border-[#213e66] bg-[linear-gradient(135deg,#112d52_0%,#163861_54%,#1f4f7d_100%)] px-6 py-8 text-center text-white shadow-[0_40px_70px_-42px_rgba(15,23,42,0.7)] sm:px-8 sm:py-10">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#8bd4ff] uppercase">
              {landing.finalEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{landing.finalTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#d3e3f4] sm:text-base">
              {landing.finalDescription}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href={withLang("/list", locale)} className={primaryCtaClass}>
                {landing.finalBrowseCta}
              </Link>
              <Link
                href={
                  isLoggedIn
                    ? withLang("/containers/new", locale)
                    : withLang(`/login?next=${nextCreate}`, locale)
                }
                className="inline-flex items-center justify-center rounded-md border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
              >
                {landing.finalCreateCta}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
