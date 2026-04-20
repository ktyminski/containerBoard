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

  return (
    <main className="w-full bg-neutral-200 text-[#10233f]">
      <section className="relative overflow-hidden border-b border-neutral-300">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/photos/background.webp')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#061933]/88" aria-hidden="true" />

        <div className="relative mx-auto grid min-h-[34rem] w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-center lg:py-20">
          <div className="max-w-3xl lg:ml-auto lg:text-right">
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              {landing.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#e2edf9] sm:text-lg lg:ml-auto">
              {landing.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3 lg:justify-end">
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

          <div className="rounded-md border border-white/12 bg-[rgba(7,24,48,0.84)] p-6 text-white shadow-[0_36px_70px_-40px_rgba(15,23,42,0.75)] backdrop-blur-sm sm:p-7">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#8bd4ff] uppercase">
              {landing.heroCardEyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{landing.heroCardTitle}</h2>
            <div className="mt-6 grid gap-3">
              {landing.heroHighlights.map((highlight) => (
                <article
                  key={highlight}
                  className="rounded-md border border-white/10 bg-white/8 p-4"
                >
                  <p className="text-sm font-semibold text-white">{highlight}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 rounded-md border border-[#2f639a] bg-[#0d2d56] px-4 py-3">
              <p className="text-sm font-semibold text-white">{landing.heroCardFooterTitle}</p>
              <p className="mt-1 text-sm text-[#d9e7f7]">{landing.heroCardFooterText}</p>
            </div>
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
                      className="group flex h-full gap-4 rounded-md border border-neutral-200 bg-white p-4 shadow-sm transition-colors duration-150 hover:border-sky-100 hover:bg-sky-50/60"
                    >
                      <div className="relative aspect-square h-full max-h-32 shrink-0 self-stretch overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
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
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-lg font-semibold text-neutral-900">
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
                              <div className="shrink-0 text-left sm:text-right">
                                <p className="text-lg font-bold leading-tight text-neutral-900">
                                  {priceLabel}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-neutral-700">
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
