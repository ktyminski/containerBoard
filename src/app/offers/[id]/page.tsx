import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AnnouncementLocationMap } from "@/components/announcement-location-map";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { normalizeExternalLink } from "@/lib/external-links";
import { sanitizeRichTextHtml } from "@/lib/html-sanitizer";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
  type AppLocale,
} from "@/lib/i18n";
import { OFFER_TYPE, normalizeOfferType } from "@/lib/offer-type";
import { getOffersCollection } from "@/lib/offers";
import {
  buildPageMetadata,
  getLocalizedCanonical,
  stripHtmlToPlainText,
} from "@/lib/seo";
import { USER_ROLE } from "@/lib/user-roles";
import { SmartBackButton } from "@/components/smart-back-button";
import { buildShortAddressLabelFromParts } from "@/lib/geocode-address";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";

type OfferDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const OFFER_PAGE_PROJECTION = {
  _id: 1,
  companyId: 1,
  companyName: 1,
  companySlug: 1,
  offerType: 1,
  title: 1,
  description: 1,
  tags: 1,
  externalLinks: 1,
  contactEmails: 1,
  contactPhones: 1,
  locationLabel: 1,
  point: 1,
  createdAt: 1,
} as const;

const getPublishedOfferById = cache(async (offerId: string) => {
  if (!ObjectId.isValid(offerId)) {
    return null;
  }

  const offers = await getOffersCollection();
  return offers.findOne(
    { _id: new ObjectId(offerId), isPublished: true },
    {
      projection: OFFER_PAGE_PROJECTION,
    },
  );
});

function toIntlLocale(locale: AppLocale): string {
  if (locale === "en") {
    return "en-US";
  }
  if (locale === "de") {
    return "de-DE";
  }
  if (locale === "uk") {
    return "uk-UA";
  }
  return "pl-PL";
}

export async function generateMetadata({
  params,
  searchParams,
}: OfferDetailsPageProps): Promise<Metadata> {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  if (!ObjectId.isValid(routeParams.id)) {
    return buildPageMetadata({
      path: `/offers/${routeParams.id}`,
      locale,
      title: messages.mapModules.offers.sectionTitle,
      description: messages.home.whatSubtitle,
      noIndex: true,
    });
  }

  const offer = await getPublishedOfferById(routeParams.id);

  if (!offer?._id) {
    return buildPageMetadata({
      path: `/offers/${routeParams.id}`,
      locale,
      title: messages.mapModules.offers.sectionTitle,
      description: messages.home.whatSubtitle,
      noIndex: true,
    });
  }

  const description = stripHtmlToPlainText(
    sanitizeRichTextHtml(offer.description),
  ).slice(0, 160);

  return buildPageMetadata({
    path: `/offers/${routeParams.id}`,
    locale,
    title: `${offer.title} - ${offer.companyName}`,
    description: description || messages.offerDetails.locationLabel,
    type: "article",
  });
}

export default async function OfferDetailsPage({
  params,
  searchParams,
}: OfferDetailsPageProps) {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentUser = sessionToken
    ? await getCurrentUserFromToken(sessionToken)
    : null;

  if (!ObjectId.isValid(routeParams.id)) {
    notFound();
  }

  const offer = await getPublishedOfferById(routeParams.id);

  if (!offer?._id) {
    notFound();
  }

  const companies = await getCompaniesCollection();
  const company = await companies.findOne(
    { _id: offer.companyId },
    {
      projection: {
        _id: 1,
        createdByUserId: 1,
        isPremium: 1,
        updatedAt: 1,
        "logo.size": 1,
        "background.size": 1,
        "locations.addressText": 1,
        "locations.addressParts": 1,
        "locations.point.coordinates": 1,
      },
    },
  );
  if (!company?._id) {
    notFound();
  }

  const canEditOffer =
    Boolean(currentUser?._id) &&
    (currentUser?.role === USER_ROLE.ADMIN ||
      company.createdByUserId?.toHexString() ===
        currentUser?._id?.toHexString());

  const companyId = company._id.toHexString();
  const isPremium = company.isPremium === true;
  const logoFallbackColor = getCompanyFallbackColor(companyId);
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(offer.companyName);
  const mediaVersion =
    company.updatedAt instanceof Date ? company.updatedAt.getTime() : 0;
  const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
  const logoUrl = company.logo?.size
    ? withMediaVersion(`/api/companies/${companyId}/logo`)
    : null;
  const backgroundUrl = company.background?.size
    ? withMediaVersion(`/api/companies/${companyId}/background`)
    : null;
  const safeDescription = sanitizeRichTextHtml(offer.description);
  const plainDescription = stripHtmlToPlainText(safeDescription);
  const externalLinks = (offer.externalLinks ?? [])
    .map((link) => normalizeExternalLink(link))
    .filter((link): link is string => Boolean(link));
  const contactEmails =
    offer.contactEmails?.filter((email) => email.trim().length > 0) ?? [];
  const contactPhones =
    offer.contactPhones?.filter((phone) => phone.trim().length > 0) ?? [];
  const locationPoint = offer.point?.coordinates ?? null;
  const matchedLocation = locationPoint
    ? (company.locations ?? []).find((location) => {
        const [lngA, latA] = location.point.coordinates;
        const [lngB, latB] = locationPoint;
        return (
          Math.abs(lngA - lngB) < 0.000001 && Math.abs(latA - latB) < 0.000001
        );
      })
    : null;
  const displayLocationLabel = buildShortAddressLabelFromParts({
    parts: matchedLocation?.addressParts,
    fallbackLabel: matchedLocation?.addressText ?? offer.locationLabel,
  });
  const offerType = normalizeOfferType(offer.offerType);
  const offerTypeLabel =
    offerType === OFFER_TYPE.TRANSPORT
      ? messages.mapModules.offers.offerTypes.transport
      : messages.mapModules.offers.offerTypes.cooperation;
  const offerUrl = getLocalizedCanonical(
    `/offers/${offer._id.toHexString()}`,
    locale,
  );
  const companyUrl = getLocalizedCanonical(
    `/companies/${offer.companySlug}`,
    locale,
  );
  const offerSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: offer.title,
    description: plainDescription,
    serviceType: offerTypeLabel,
    areaServed: displayLocationLabel,
    provider: {
      "@type": "Organization",
      name: offer.companyName,
      url: companyUrl,
    },
    offers: {
      "@type": "Offer",
      url: offerUrl,
      category: offerTypeLabel,
      availability: "https://schema.org/InStock",
    },
    url: offerUrl,
  };

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-10 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(offerSchema) }}
        />

        <SmartBackButton
          label={messages.companyDetails.back}
          fallbackHref={withLang("/maps/offers", locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        />
        {canEditOffer ? (
          <div>
            <Link
              href={withLang(`/offers/${offer._id.toHexString()}/edit`, locale)}
              className="rounded-md border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500"
            >
              {messages.offerEdit.action}
            </Link>
          </div>
        ) : null}

        <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="relative aspect-[4/1] w-full">
            {backgroundUrl ? (
              <Image
                src={backgroundUrl}
                alt={`${offer.companyName} background`}
                fill
                className="object-cover"
                sizes="(max-width: 1280px) 100vw, 900px"
              />
            ) : (
              <div className="h-full w-full" style={{ backgroundImage: backgroundFallbackGradient }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
            <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
              <div
                className={`relative h-12 w-12 rounded-lg border border-slate-700 bg-slate-900 sm:h-12 sm:w-12 md:h-20 md:w-20 lg:h-24 lg:w-24 ${
                  isPremium ? "overflow-visible" : "overflow-hidden"
                }`}
              >
                <div className="h-full w-full overflow-hidden rounded-[inherit]">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={`${offer.companyName} logo`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 767px) 48px, (max-width: 1023px) 80px, 96px"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-lg font-semibold text-white md:text-2xl"
                      style={{ backgroundColor: logoFallbackColor }}
                      aria-label={`${offer.companyName} logo`}
                    >
                      {logoFallbackInitial}
                    </div>
                  )}
                </div>
                {isPremium ? (
                  <span
                    className="absolute left-0 top-0 z-20 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-400/80 bg-slate-950/90 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)] md:h-6 md:w-6"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true">
                      <path
                        d="M10 2.9l2.15 4.35 4.8.7-3.47 3.38.82 4.78L10 13.95 5.7 16.1l.82-4.78L3.05 7.95l4.8-.7L10 2.9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-xl font-semibold text-slate-100 sm:text-2xl"
                  title={offer.companyName}
                >
                  {offer.companyName}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 text-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <div className="grid gap-4">
                <p>
                  <span className="inline-flex rounded-md border border-cyan-500/60 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                    {offerTypeLabel}
                  </span>
                </p>
                <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                  {offer.title}
                </h1>

                <div className="text-sm text-slate-200 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p+p]:mt-3 [&_p:empty]:block [&_p:empty]:h-4 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal">
                  {safeDescription ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: safeDescription }}
                    />
                  ) : (
                    <p className="text-slate-500">-</p>
                  )}
                </div>

                {externalLinks.length > 0 ? (
                  <div className="grid gap-2">
                    <p className="text-xs font-medium text-slate-400">
                      {messages.offerDetails.externalLinksLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {externalLinks.map((link) => (
                        <a
                          key={link}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="max-w-full truncate rounded-md border border-slate-700 px-2 py-1 text-xs text-sky-300 hover:border-sky-500"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="h-fit rounded-xl border border-slate-700/80 bg-slate-950/70 p-4">
                <div className="grid gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {messages.companyDetails.phoneLabel}
                    </p>
                    {contactPhones.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {contactPhones.map((phone) => (
                          <li key={phone}>
                            <a
                              href={`tel:${phone.replace(/\s+/g, "")}`}
                              className="inline-flex text-sm text-slate-100 transition-colors hover:text-sky-300"
                            >
                              {phone}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">-</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {messages.companyDetails.emailLabel}
                    </p>
                    {contactEmails.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {contactEmails.map((email) => (
                          <li key={email}>
                            <a
                              href={`mailto:${email}`}
                              className="inline-flex text-sm text-slate-100 transition-colors hover:text-sky-300"
                            >
                              {email}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">-</p>
                    )}
                  </div>
                </div>
              </aside>
            </div>

            <div className="grid gap-2 border-t border-slate-800 pt-4">
              <p className="text-right text-xs text-slate-400">
                {messages.offerDetails.createdLabel}:{" "}
                {offer.createdAt?.toLocaleString(toIntlLocale(locale)) ?? "-"}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={withLang(`/companies/${offer.companySlug}`, locale)}
                  className="rounded-md border border-sky-700 px-4 py-2 text-sm text-sky-200 hover:border-sky-500"
                >
                  {messages.offerDetails.goToCompany}
                </Link>
              </div>
            </div>
          </div>
        </article>

        {locationPoint ? (
          <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-slate-100">
              {messages.offerDetails.locationMapTitle}
            </h2>
            <AnnouncementLocationMap
              point={locationPoint}
              label={displayLocationLabel}
            />
          </section>
        ) : null}
      </main>
    </section>
  );
}

