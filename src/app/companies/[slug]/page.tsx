import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CompanyDeletionRequestButton } from "@/components/company-deletion-request-button";
import { CompanyProfileListings } from "@/components/company-profile-listings";
import { CompanyLocationsAndBranches } from "@/components/company-locations-and-branches";
import { SmartBackButton } from "@/components/smart-back-button";
import { FacebookIcon, InstagramIcon, LinkedInIcon } from "@/components/social-icons";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
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
} from "@/lib/i18n";
import { buildShortAddressLabelFromParts } from "@/lib/geocode-address";
import { buildPageMetadata, getAbsoluteUrl, getLocalizedCanonical } from "@/lib/seo";
import {
  getCompanyInitial,
} from "@/lib/company-logo-fallback";
import { USER_ROLE } from "@/lib/user-roles";

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
  tags: 1,
  services: 1,
  "logo.size": 1,
  "logo.filename": 1,
  "background.size": 1,
  "background.filename": 1,
  updatedAt: 1,
  "locations.label": 1,
  "locations.addressText": 1,
  "locations.addressParts": 1,
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

  const verificationStatus = normalizeCompanyVerificationStatus(company.verificationStatus);
  const isIndexable =
    verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED &&
    company.isBlocked !== true;

  return buildPageMetadata({
    path: `/companies/${routeParams.slug}`,
    locale,
    title: company.name,
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
  const isOwner =
    Boolean(currentUser?._id) &&
    company.createdByUserId?.toHexString() === currentUser?._id?.toHexString();
  const operatingArea = normalizeCompanyOperatingArea(company.operatingArea);
  const operatingAreaLabel = messages.companyCreate.operatingAreas[operatingArea];
  const fallbackBackHref = withLang(canEdit ? "/containers/mine" : "/list", locale);
  const logoUrl = company.logo?.size || company.logo?.filename ? `/api/companies/${companyId}/logo` : null;
  const backgroundUrl = company.background?.size || company.background?.filename
    ? `/api/companies/${companyId}/background`
    : null;
  const mediaVersion = company.updatedAt instanceof Date
    ? company.updatedAt.getTime()
    : 0;
  const logoFallbackColor = "#05244f";
  const backgroundPlaceholderStyle = {
    backgroundImage: "linear-gradient(180deg,#d4d4d8_0%,#a1a1aa_100%)",
  };
  const logoFallbackInitial = getCompanyInitial(company.name);
  const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
  const backgroundOverlayClass = backgroundUrl
    ? "absolute inset-0 bg-gradient-to-t from-neutral-950/78 via-neutral-900/45 to-transparent"
    : "";
  const companyNameClass = backgroundUrl
    ? "max-w-[400px] min-w-0 truncate text-lg font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-2xl"
    : "max-w-[400px] min-w-0 truncate text-lg font-semibold text-neutral-900 sm:text-2xl";
  const neutralActionButtonClass =
    "inline-flex items-center rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500 hover:bg-neutral-50";
  const primaryActionButtonClass =
    "inline-flex items-center rounded-md bg-[#05244f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a356d]";

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
        postalCode: location.addressParts?.postalCode?.trim() ?? "",
        country: location.addressParts?.country?.trim() ?? "",
        phone: (location.phone ?? company.phone)?.trim() || undefined,
        email: (location.email ?? company.email)?.trim() || undefined,
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
  const allCompanyListingsHref = withLang(
    `/list?company=${encodeURIComponent(company.slug)}`,
    locale,
  );

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
    "inline-flex h-[54px] w-[54px] items-center justify-center rounded-full border border-neutral-300 bg-white/92 text-neutral-700 shadow-sm backdrop-blur transition-colors hover:border-neutral-400 hover:bg-white";
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
    <section>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SmartBackButton
              label={messages.companyDetails.back}
              fallbackHref={fallbackBackHref}
              className={`${neutralActionButtonClass} w-fit cursor-pointer gap-2`}
            />
            <Link
              href={withLang("/list", locale)}
              className={neutralActionButtonClass}
            >
              {messages.companyDetails.backToMap}
            </Link>
          </div>
          {canEdit ? (
            <Link
              href={withLang(`/companies/${company.slug}/edit`, locale)}
              className={`${primaryActionButtonClass} ml-auto`}
            >
              {messages.companyDetails.editCompany}
            </Link>
          ) : null}
        </div>
        <section className="overflow-hidden rounded-xl border border-neutral-300 bg-neutral-100/95 shadow-sm">
          <div className="relative aspect-[4/1] w-full overflow-hidden bg-neutral-300">
            {backgroundUrl ? (
              <Image
                src={withMediaVersion(backgroundUrl)}
                alt={formatTemplate(messages.companyDetails.backgroundAlt, { company: company.name })}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 1280px"
              />
            ) : (
              <div className="h-full w-full" style={backgroundPlaceholderStyle} />
            )}
            {backgroundOverlayClass ? <div className={backgroundOverlayClass} /> : null}
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
                className={`relative h-12 w-12 rounded-lg border-2 border-neutral-300 bg-neutral-700 shadow-lg sm:h-12 sm:w-12 md:h-24 md:w-24 lg:h-32 lg:w-32 ${
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
                    className="absolute left-0 top-0 z-20 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300 bg-white/95 text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.25)] md:h-6 md:w-6"
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
                  <p className={companyNameClass}>
                    {company.name}
                  </p>
                  {isVerified ? (
                    <span
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/80 bg-emerald-100/80 text-emerald-700"
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
              </div>
            </div>
          </div>
          {hasSocialLinks ? (
            <div className="flex items-center justify-center gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 md:hidden">
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
          <div className="grid gap-5 p-5 text-sm text-neutral-700">
            <section className="grid gap-5 md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <div className="grid gap-2">
                <p className="whitespace-pre-wrap">
                  {company.description}
                </p>
                {/* Tags and services intentionally hidden in company details view. */}
              </div>

              <aside className="h-fit rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="grid gap-2">
                  {companyPhone ? (
                    <div className="rounded-lg border border-neutral-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                        {messages.companyDetails.phoneLabel}
                      </p>
                      <a
                        href={`tel:${companyPhone.replace(/\s+/g, "")}`}
                        className="mt-1 inline-flex text-sm text-neutral-800 transition-colors hover:text-sky-700"
                      >
                        {companyPhone}
                      </a>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                      {messages.companyDetails.emailLabel}
                    </p>
                    {company.email ? (
                      <a
                        href={`mailto:${company.email}`}
                        className="mt-1 inline-flex text-sm text-neutral-800 transition-colors hover:text-sky-700"
                      >
                        {company.email}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-neutral-500">-</p>
                    )}
                  </div>
                  {company.website ? (
                    <div className="rounded-lg border border-neutral-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                        {messages.companyDetails.websiteLabel}
                      </p>
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex break-all text-sm text-sky-700 transition-colors hover:text-sky-800"
                      >
                        {company.website}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                    {messages.companyDetails.operatingAreaLabel}
                  </p>
                  <p className="mt-1 text-sm text-neutral-800">{operatingAreaLabel}</p>
                  {company.operatingAreaDetails ? (
                    <p className="mt-1 text-xs text-neutral-600">{company.operatingAreaDetails}</p>
                  ) : null}
                </div>
                {company.nip ? (
                  <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                      {messages.companyDetails.nipLabel}
                    </p>
                    <p className="mt-1 text-sm text-neutral-800">{company.nip}</p>
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
                phoneLabel: messages.companyDetails.phoneLabel,
                emailLabel: messages.companyDetails.emailLabel,
                showMoreBranches: messages.companyDetails.showMoreBranches,
              }}
            />
          </div>
        </section>
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-lg font-semibold text-neutral-900">
              {messages.containerListings.related.companyLatestTitle}
            </h2>
            <Link
              href={allCompanyListingsHref}
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-700"
            >
              <span>{messages.containerListings.related.showAll}</span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M7 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
          <CompanyProfileListings
            companySlug={company.slug}
            isLoggedIn={Boolean(currentUser?._id)}
            limit={3}
            allListingsHref={allCompanyListingsHref}
          />
        </section>
        {isOwner ? (
          <div className="flex justify-end px-1">
            <CompanyDeletionRequestButton
              companyId={companyId}
              locale={locale}
              messages={messages.companyPanelPage}
              triggerClassName="cursor-pointer text-xs text-neutral-500 underline underline-offset-2 transition-colors hover:text-rose-700"
            />
          </div>
        ) : null}
      </main>
    </section>
  );
}



