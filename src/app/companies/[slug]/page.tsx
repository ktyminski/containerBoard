import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CompanyLocationsAndBranches } from "@/components/company-locations-and-branches";
import { CompanyOwnershipClaimButton } from "@/components/company-ownership-claim-button";
import { ShowMoreItems } from "@/components/show-more-items";
import { SmartBackButton } from "@/components/smart-back-button";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/social-icons";
import { getAnnouncementsCollection } from "@/lib/announcements";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { COMPANY_BENEFITS, type CompanyBenefit } from "@/lib/company-benefits";
import { normalizeCompanyOperatingArea } from "@/lib/company-operating-area";
import {
  COMPANY_VERIFICATION_STATUS,
  normalizeCompanyVerificationStatus,
} from "@/lib/company-verification";
import {
  getCompaniesCollection,
} from "@/lib/companies";
import {
  formatTemplate,
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
  type AppLocale,
} from "@/lib/i18n";
import { buildShortAddressLabelFromParts } from "@/lib/geocode-address";
import { buildPageMetadata, getAbsoluteUrl, getLocalizedCanonical } from "@/lib/seo";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";
import { OFFER_TYPE, normalizeOfferType } from "@/lib/offer-type";
import { getOffersCollection } from "@/lib/offers";
import { USER_ROLE } from "@/lib/user-roles";
import { normalizeCompanyCommunicationLanguages } from "@/types/company-communication-language";
import { normalizeCompanyCategory } from "@/types/company-category";
import {
  COMPANY_SPECIALIZATIONS,
  type CompanySpecialization,
} from "@/types/company-specialization";

type CompanyDetailsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const COMPANY_PAGE_PROJECTION = {
  _id: 1,
  name: 1,
  slug: 1,
  createdByUserId: 1,
  description: 1,
  category: 1,
  communicationLanguage: 1,
  communicationLanguages: 1,
  operatingArea: 1,
  operatingAreaDetails: 1,
  nip: 1,
  verificationStatus: 1,
  isPremium: 1,
  isBlocked: 1,
  phone: 1,
  email: 1,
  website: 1,
  facebookUrl: 1,
  instagramUrl: 1,
  linkedinUrl: 1,
  benefits: 1,
  specializations: 1,
  tags: 1,
  services: 1,
  "logo.size": 1,
  "logo.filename": 1,
  "background.size": 1,
  "background.filename": 1,
  "photos.size": 1,
  "photos.filename": 1,
  updatedAt: 1,
  "locations.label": 1,
  "locations.addressText": 1,
  "locations.addressParts": 1,
  "locations.note": 1,
  "locations.phone": 1,
  "locations.email": 1,
  "locations.point": 1,
  "locations.photos.size": 1,
  "locations.photos.filename": 1,
} as const;

const getCompanyBySlug = cache(async (slug: string) => {
  const companies = await getCompaniesCollection();
  return companies.findOne(
    { slug },
    {
      projection: COMPANY_PAGE_PROJECTION,
    },
  );
});

function isValidPoint(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }
  const [lng, lat] = value;
  return (
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

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
}: CompanyDetailsPageProps): Promise<Metadata> {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const company = await getCompanyBySlug(routeParams.slug);

  if (!company?._id) {
    return buildPageMetadata({
      path: `/companies/${routeParams.slug}`,
      locale,
      title: messages.mapModules.tabs.companies,
      description: messages.home.whatSubtitle,
      noIndex: true,
    });
  }

  const categoryLabel = messages.map.categories[normalizeCompanyCategory(company.category)];
  const verificationStatus = normalizeCompanyVerificationStatus(company.verificationStatus);
  const isIndexable =
    verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED &&
    company.isBlocked !== true;

  return buildPageMetadata({
    path: `/companies/${routeParams.slug}`,
    locale,
    title: `${company.name} - ${categoryLabel}`,
    description: company.description.slice(0, 160),
    type: "article",
    noIndex: !isIndexable,
  });
}

export default async function CompanyDetailsPage({
  params,
  searchParams,
}: CompanyDetailsPageProps) {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentUser = sessionToken ? await getCurrentUserFromToken(sessionToken) : null;

  const company = await getCompanyBySlug(routeParams.slug);

  if (!company?._id) {
    notFound();
  }

  const companyId = company._id.toHexString();
  const verificationStatus = normalizeCompanyVerificationStatus(company.verificationStatus);
  const isVerified = verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED;
  const isPremium = company.isPremium === true;
  const canEdit =
    Boolean(currentUser?._id) &&
    (
      currentUser?.role === USER_ROLE.ADMIN ||
      company.createdByUserId?.toHexString() === currentUser?._id?.toHexString()
    );
  const categoryLabel = messages.map.categories[normalizeCompanyCategory(company.category)];
  const operatingArea = normalizeCompanyOperatingArea(company.operatingArea);
  const operatingAreaLabel = messages.companyCreate.operatingAreas[operatingArea];
  const fallbackBackHref = withLang(canEdit ? "/companies/panel" : "/maps", locale);
  const logoUrl = company.logo?.size || company.logo?.filename ? `/api/companies/${companyId}/logo` : null;
  const backgroundUrl = company.background?.size || company.background?.filename
    ? `/api/companies/${companyId}/background`
    : null;
  const mediaVersion = company.updatedAt instanceof Date
    ? company.updatedAt.getTime()
    : 0;
  const logoFallbackColor = getCompanyFallbackColor(companyId);
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(company.name);
  const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
  const companyPhotos = (company.photos ?? []).map((_, index) => ({
    id: `company-photo-${index}`,
    url: withMediaVersion(`/api/companies/${companyId}/photos/${index}`),
    alt: formatTemplate(messages.companyDetails.companyPhotoAlt, {
      company: company.name,
      index: index + 1,
    }),
  }));

  const locations = (company.locations ?? [])
    .map((location, index) => {
      const point = location?.point?.coordinates;
      if (!isValidPoint(point)) {
        return null;
      }

      return {
        label: location.label,
        addressText: location.addressText,
        addressDisplayText: buildShortAddressLabelFromParts({
          parts: location.addressParts,
          fallbackLabel: location.addressText,
        }),
        note: location.note,
        phone: location.phone,
        email: location.email,
        point: {
          coordinates: point,
        },
        isMain: index === 0,
        photos: (location.photos ?? []).map((_, photoIndex) => ({
          id: `branch-${index}-photo-${photoIndex}`,
          url: withMediaVersion(`/api/companies/${companyId}/branches/${index}/photos/${photoIndex}`),
          alt: formatTemplate(messages.companyDetails.branchPhotoAlt, {
            branch: location.label,
            index: photoIndex + 1,
          }),
        })),
      };
    })
    .filter((location): location is NonNullable<typeof location> => location !== null);

  const [offerRows, announcementRows] = await Promise.all([
    (await getOffersCollection())
      .find(
        { companyId: company._id, isPublished: true },
        {
          projection: {
            _id: 1,
            title: 1,
            offerType: 1,
            locationLabel: 1,
            createdAt: 1,
          },
          sort: { createdAt: -1 },
          limit: 24,
        },
      )
      .toArray(),
    (await getAnnouncementsCollection())
      .find(
        { companyId: company._id, isPublished: true },
        {
          projection: {
            _id: 1,
            title: 1,
            createdAt: 1,
          },
          sort: { createdAt: -1 },
          limit: 24,
        },
      )
      .toArray(),
  ]);

  const publishedOffers = offerRows
    .filter((offer) => offer._id && offer.title)
    .map((offer) => ({
      id: offer._id.toHexString(),
      title: offer.title,
      offerType: normalizeOfferType(offer.offerType),
      locationLabel: offer.locationLabel ?? "-",
      createdAt: offer.createdAt,
    }));

  const publishedAnnouncements = announcementRows
    .filter((announcement) => announcement._id && announcement.title)
    .map((announcement) => ({
      id: announcement._id.toHexString(),
      title: announcement.title,
      createdAt: announcement.createdAt,
    }));
  const specializationSet = new Set<string>(COMPANY_SPECIALIZATIONS);
  const companySpecializations = (company.specializations ?? []).filter(
    (specialization): specialization is CompanySpecialization =>
      specializationSet.has(specialization),
  );
  const benefitSet = new Set<string>(COMPANY_BENEFITS);
  const companyBenefits = (company.benefits ?? []).filter(
    (benefit): benefit is CompanyBenefit => benefitSet.has(benefit),
  );
  const companyCommunicationLanguages = normalizeCompanyCommunicationLanguages([
    ...(company.communicationLanguages ?? []),
    ...(company.communicationLanguage ? [company.communicationLanguage] : []),
  ]);
  const companyUrl = getLocalizedCanonical(`/companies/${company.slug}`, locale);
  const companyPhone = company.phone?.trim() || undefined;
  const sameAs = [
    company.website,
    company.facebookUrl,
    company.instagramUrl,
    company.linkedinUrl,
  ].filter((entry): entry is string => Boolean(entry));
  const hasSocialLinks = Boolean(
    company.facebookUrl || company.instagramUrl || company.linkedinUrl,
  );
  const socialIconButtonClass =
    "inline-flex h-[54px] w-[54px] items-center justify-center rounded-full border border-slate-200/30 bg-slate-900/65 text-slate-100 backdrop-blur transition-colors hover:border-sky-300/70 hover:bg-sky-500/25 hover:text-white";
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    description: company.description,
    url: companyUrl,
    logo: logoUrl ? getAbsoluteUrl(withMediaVersion(logoUrl)) : undefined,
    image: backgroundUrl ? getAbsoluteUrl(withMediaVersion(backgroundUrl)) : undefined,
    email: company.email,
    telephone: companyPhone,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
    location: locations.map((location) => ({
      "@type": "Place",
      name: location.label,
      address: location.addressText,
      geo: {
        "@type": "GeoCoordinates",
        latitude: location.point.coordinates[1],
        longitude: location.point.coordinates[0],
      },
    })),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <SmartBackButton
        label={messages.companyDetails.back}
        fallbackHref={fallbackBackHref}
        className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
      />
        {canEdit ? (
          <div>
            <Link
              href={withLang(`/companies/${company.slug}/edit`, locale)}
              className="rounded-md border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500"
            >
              {messages.companyDetails.editCompany}
            </Link>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="relative aspect-[4/1] w-full overflow-hidden bg-slate-950">
            {backgroundUrl ? (
              <Image
                src={withMediaVersion(backgroundUrl)}
                alt={formatTemplate(messages.companyDetails.backgroundAlt, { company: company.name })}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 1280px"
              />
            ) : (
              <div className="h-full w-full" style={{ backgroundImage: backgroundFallbackGradient }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
            {hasSocialLinks ? (
              <div className="absolute right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-2 md:flex">
                {company.facebookUrl ? (
                  <a
                    href={company.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={messages.companyDetails.facebookLabel}
                    className={socialIconButtonClass}
                  >
                    <FacebookIcon className="h-6 w-6" />
                  </a>
                ) : null}
                {company.instagramUrl ? (
                  <a
                    href={company.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={messages.companyDetails.instagramLabel}
                    className={socialIconButtonClass}
                  >
                    <InstagramIcon className="h-6 w-6" />
                  </a>
                ) : null}
                {company.linkedinUrl ? (
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={messages.companyDetails.linkedinLabel}
                    className={socialIconButtonClass}
                  >
                    <LinkedInIcon className="h-6 w-6" />
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="absolute inset-x-4 bottom-6 z-10 flex items-end gap-3 sm:bottom-8">
              <div
                className={`relative h-12 w-12 rounded-lg border-2 border-slate-700 bg-slate-950 shadow-lg sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32 ${
                  isPremium ? "overflow-visible" : "overflow-hidden"
                }`}
              >
                <div className="h-full w-full overflow-hidden rounded-[inherit]">
                {logoUrl ? (
                  <Image
                    src={withMediaVersion(logoUrl)}
                    alt={formatTemplate(messages.companyDetails.logoAlt, { company: company.name })}
                    fill
                    className="object-cover"
                    sizes="(max-width: 767px) 48px, (max-width: 1023px) 96px, 128px"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white"
                    style={{ backgroundColor: logoFallbackColor }}
                    aria-label={formatTemplate(messages.companyDetails.logoAlt, { company: company.name })}
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
              <div className="min-w-0 pb-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p
                    className="max-w-[400px] min-w-0 truncate text-lg font-semibold text-white sm:text-2xl"
                    style={{
                      textShadow:
                        "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                    }}
                  >
                    {company.name}
                  </p>
                  {isVerified ? (
                    <span
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/20 text-emerald-300"
                      aria-label={messages.companyStatus.verified}
                      title={messages.companyStatus.verified}
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M5 10.5l3.2 3.2L15 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </div>
                <p
                  className="mt-1 max-w-[400px] min-w-0 truncate text-sm text-slate-200/95 sm:text-base"
                  style={{
                    textShadow:
                      "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                  }}
                >
                  {categoryLabel}
                </p>
              </div>
            </div>
          </div>
          {hasSocialLinks ? (
            <div className="flex items-center justify-center gap-2 border-t border-slate-800/70 bg-slate-950/60 px-4 py-3 md:hidden">
              {company.facebookUrl ? (
                <a
                  href={company.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={messages.companyDetails.facebookLabel}
                  className={socialIconButtonClass}
                >
                  <FacebookIcon className="h-6 w-6" />
                </a>
              ) : null}
              {company.instagramUrl ? (
                <a
                  href={company.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={messages.companyDetails.instagramLabel}
                  className={socialIconButtonClass}
                >
                  <InstagramIcon className="h-6 w-6" />
                </a>
              ) : null}
              {company.linkedinUrl ? (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={messages.companyDetails.linkedinLabel}
                  className={socialIconButtonClass}
                >
                  <LinkedInIcon className="h-6 w-6" />
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-5 p-5 text-sm text-slate-200">
            <section className="grid gap-5 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <div className="grid gap-2">
                <p className="whitespace-pre-wrap">
                  {company.description}
                </p>
                {companyCommunicationLanguages.length > 0 ? (
                  <>
                    <div className="py-2">
                      <div className="border-t border-slate-800" />
                    </div>
                    <p>
                      <span className="text-slate-400">{messages.companyCreate.communicationLanguagesTitle}: </span>
                      {companyCommunicationLanguages
                        .map((language) => messages.companyCreate.communicationLanguages[language])
                        .join(", ")}
                    </p>
                  </>
                ) : null}
                {/* Tags and services intentionally hidden in company details view. */}
                {companySpecializations.length > 0 ? (
                  <div>
                    <p>
                      <span className="text-slate-400">{messages.companyCreate.specializationsTitle}: </span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {companySpecializations.map((specialization) => (
                        <span
                          key={specialization}
                          className="inline-flex items-center rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100"
                        >
                          {messages.companyCreate.specializationsOptions[specialization]}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {companyBenefits.length > 0 ? (
                  <div>
                    <p>
                      <span className="text-slate-400">{messages.companyCreate.benefitsTitle}: </span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {companyBenefits.map((benefit) => (
                        <span
                          key={benefit}
                          className="inline-flex items-center rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100"
                        >
                          {messages.companyCreate.benefitsOptions[benefit]}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="h-fit rounded-xl border border-slate-700/80 bg-slate-950/70 p-4">
                <div className="grid gap-2">
                  {companyPhone ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {messages.companyDetails.phoneLabel}
                      </p>
                      <a
                        href={`tel:${companyPhone.replace(/\s+/g, "")}`}
                        className="mt-1 inline-flex text-sm text-slate-100 transition-colors hover:text-sky-300"
                      >
                        {companyPhone}
                      </a>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {messages.companyDetails.emailLabel}
                    </p>
                    {company.email ? (
                      <a
                        href={`mailto:${company.email}`}
                        className="mt-1 inline-flex text-sm text-slate-100 transition-colors hover:text-sky-300"
                      >
                        {company.email}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">-</p>
                    )}
                  </div>
                  {company.website ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {messages.companyDetails.websiteLabel}
                      </p>
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex break-all text-sm text-sky-300 transition-colors hover:text-sky-200"
                      >
                        {company.website}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {messages.companyDetails.operatingAreaLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-100">{operatingAreaLabel}</p>
                  {company.operatingAreaDetails ? (
                    <p className="mt-1 text-xs text-slate-300">{company.operatingAreaDetails}</p>
                  ) : null}
                </div>
                {company.nip ? (
                  <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {messages.companyDetails.nipLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">{company.nip}</p>
                  </div>
                ) : null}
              </aside>
            </section>

            <CompanyLocationsAndBranches
              locations={locations.map((location) => ({
                ...location,
                addressText: location.addressDisplayText,
              }))}
              labels={{
                locationsTitle: messages.companyDetails.locationsTitle,
                branchesTitle: messages.companyDetails.branchesTitle,
                mainLocationBadge: messages.companyDetails.mainLocationBadge,
                phoneLabel: messages.companyDetails.phoneLabel,
                emailLabel: messages.companyDetails.emailLabel,
                showMoreBranches: messages.companyDetails.showMoreBranches,
              }}
            />

            {companyPhotos.length > 0 ? (
              <section className="grid gap-3 border-t border-slate-800 pt-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {companyPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative h-36 overflow-hidden rounded-lg border border-slate-800 md:h-44"
                    >
                      <Image
                        src={photo.url}
                        alt={photo.alt}
                        fill
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {!company.createdByUserId ? (
              <section className="border-t border-slate-800 pt-5">
                <CompanyOwnershipClaimButton
                  companyId={companyId}
                  locale={locale}
                  messages={messages.companyDetails.ownershipClaim}
                />
              </section>
            ) : null}
          </div>
        </section>

        {publishedOffers.length > 0 ? (
          <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-slate-100">
              {formatTemplate(messages.companyDetails.offersAndCooperationTitle, {
                count: publishedOffers.length,
              })}
            </h2>
            <ShowMoreItems
              className="grid gap-2"
              showMoreLabel={messages.companyDetails.loadMoreOffers}
            >
              {publishedOffers.map((offer) => (
                <article
                  key={offer.id}
                  className="min-w-0 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2 overflow-hidden">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p
                        className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight text-slate-100"
                        title={offer.title}
                      >
                        {offer.title}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-md border border-cyan-500/60 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                      {offer.offerType === OFFER_TYPE.TRANSPORT
                        ? messages.mapModules.offers.offerTypes.transport
                        : messages.mapModules.offers.offerTypes.cooperation}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-end text-[11px] text-slate-400">
                    <p>
                      {messages.companyDetails.createdLabel}:{" "}
                      {offer.createdAt?.toLocaleString(toIntlLocale(locale)) ?? "-"}
                    </p>
                  </div>
                  <div className="mt-1.5 flex justify-end text-xs">
                    <Link
                      href={withLang(`/offers/${offer.id}`, locale)}
                      className="text-sky-300 hover:text-sky-200"
                    >
                      {messages.companyDetails.openOffer}
                    </Link>
                  </div>
                </article>
              ))}
            </ShowMoreItems>
          </section>
        ) : null}

        {publishedAnnouncements.length > 0 ? (
          <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-slate-100">
              {formatTemplate(messages.companyDetails.announcementsTitle, {
                count: publishedAnnouncements.length,
              })}
            </h2>
            <ShowMoreItems
              className="grid gap-2"
              showMoreLabel={messages.companyDetails.loadMoreOffers}
            >
              {publishedAnnouncements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="min-w-0 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2"
                >
                  <div className="min-w-0 overflow-hidden">
                    <p
                      className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-tight text-slate-100"
                      title={announcement.title}
                    >
                      {announcement.title}
                    </p>
                  </div>
                  <div className="mt-1 flex justify-end text-[11px] text-slate-400">
                    <p>
                      {messages.companyDetails.createdLabel}:{" "}
                      {announcement.createdAt?.toLocaleString(toIntlLocale(locale)) ?? "-"}
                    </p>
                  </div>
                  <div className="mt-1.5 flex justify-end text-xs">
                    <Link
                      href={withLang(`/announcements/${announcement.id}`, locale)}
                      className="text-sky-300 hover:text-sky-200"
                    >
                      {messages.companyDetails.openAnnouncement}
                    </Link>
                  </div>
                </article>
              ))}
            </ShowMoreItems>
          </section>
        ) : null}

        <div>
          <Link
            href={withLang("/maps", locale)}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            {messages.companyDetails.backToMap}
          </Link>
        </div>
      </main>
    </section>
  );
}

