import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AnnouncementApplyForm } from "@/components/announcement-apply-form";
import { AnnouncementCopyLinkButton } from "@/components/announcement-copy-link-button";
import { AnnouncementFavoriteToggle } from "@/components/announcement-favorite-toggle";
import { AnnouncementLocationMap } from "@/components/announcement-location-map";
import { SmartBackButton } from "@/components/smart-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getAnnouncementFavoritesCollection } from "@/lib/announcement-favorites";
import { getAnnouncementsCollection } from "@/lib/announcements";
import { COMPANY_BENEFITS, type CompanyBenefit } from "@/lib/company-benefits";
import { getCompaniesCollection } from "@/lib/companies";
import { normalizeExternalLink } from "@/lib/external-links";
import {
  buildShortAddressLabelFromParts,
  normalizeGeocodeAddressParts,
} from "@/lib/geocode-address";
import { getUserCvCollection } from "@/lib/user-cv";
import { sanitizeRichTextHtml } from "@/lib/html-sanitizer";
import {
  formatTemplate,
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
  type AppLocale,
} from "@/lib/i18n";
import {
  JOB_ANNOUNCEMENT_REQUIREMENTS,
  JOB_WORK_LOCATION_MODE,
  type JobAnnouncementRequirement,
  type JobContractType,
  type JobRatePeriod,
} from "@/lib/job-announcement";
import { buildPageMetadata, getLocalizedCanonical, stripHtmlToPlainText } from "@/lib/seo";
import { USER_ROLE } from "@/lib/user-roles";
import {
  getCompanyFallbackColor,
  getCompanyFallbackGradient,
  getCompanyInitial,
} from "@/lib/company-logo-fallback";

type AnnouncementDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ANNOUNCEMENT_PAGE_PROJECTION = {
  _id: 1,
  companyId: 1,
  companyName: 1,
  companySlug: 1,
  title: 1,
  description: 1,
  location: 1,
  branchIndex: 1,
  employmentType: 1,
  workModel: 1,
  contractTypes: 1,
  salaryFrom: 1,
  salaryTo: 1,
  salaryRatePeriod: 1,
  tags: 1,
  requirements: 1,
  externalLinks: 1,
  contactPersons: 1,
  createdAt: 1,
} as const;

const getPublishedAnnouncementById = cache(async (announcementId: string) => {
  if (!ObjectId.isValid(announcementId)) {
    return null;
  }

  const announcements = await getAnnouncementsCollection();
  return announcements.findOne(
    { _id: new ObjectId(announcementId), isPublished: true },
    {
      projection: ANNOUNCEMENT_PAGE_PROJECTION,
    },
  );
});

function resolveBranchIndex(input: {
  branchIndex?: number;
  locationLabel: string;
  companyLocations: Array<{ label: string; addressText: string }>;
}): number | null {
  if (
    typeof input.branchIndex === "number" &&
    Number.isInteger(input.branchIndex) &&
    input.branchIndex >= 0 &&
    input.branchIndex < input.companyLocations.length
  ) {
    return input.branchIndex;
  }

  const inferredIndex = input.companyLocations.findIndex(
    (location) => `${location.label} - ${location.addressText}` === input.locationLabel,
  );

  return inferredIndex >= 0 ? inferredIndex : null;
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

function formatSalary(input: {
  salaryFrom?: number;
  salaryTo?: number;
  salaryRatePeriod: JobRatePeriod;
  locale: AppLocale;
  periodLabel: string;
  salaryRangeTemplate: string;
  salaryFromTemplate: string;
  salaryToTemplate: string;
}): string | null {
  const fromValue =
    typeof input.salaryFrom === "number" && Number.isFinite(input.salaryFrom) && input.salaryFrom > 0
      ? input.salaryFrom
      : undefined;
  const toValue =
    typeof input.salaryTo === "number" && Number.isFinite(input.salaryTo) && input.salaryTo > 0
      ? input.salaryTo
      : undefined;
  if (fromValue === undefined && toValue === undefined) {
    return null;
  }

  const formatter = new Intl.NumberFormat(toIntlLocale(input.locale), {
    maximumFractionDigits: 0,
  });

  const fromText = fromValue !== undefined ? formatter.format(fromValue) : null;
  const toText = toValue !== undefined ? formatter.format(toValue) : null;
  if (fromText && toText) {
    return formatTemplate(input.salaryRangeTemplate, {
      from: fromText,
      to: toText,
      suffix: input.periodLabel,
    });
  }
  if (fromText) {
    return formatTemplate(input.salaryFromTemplate, {
      value: fromText,
      suffix: input.periodLabel,
    });
  }
  if (toText) {
    return formatTemplate(input.salaryToTemplate, {
      value: toText,
      suffix: input.periodLabel,
    });
  }
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: AnnouncementDetailsPageProps): Promise<Metadata> {
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
      path: `/announcements/${routeParams.id}`,
      locale,
      title: messages.mapModules.announcements.sectionTitle,
      description: messages.home.whatSubtitle,
      noIndex: true,
    });
  }

  const announcement = await getPublishedAnnouncementById(routeParams.id);

  if (!announcement?._id) {
    return buildPageMetadata({
      path: `/announcements/${routeParams.id}`,
      locale,
      title: messages.mapModules.announcements.sectionTitle,
      description: messages.home.whatSubtitle,
      noIndex: true,
    });
  }

  const description = stripHtmlToPlainText(sanitizeRichTextHtml(announcement.description))
    .slice(0, 160);

  return buildPageMetadata({
    path: `/announcements/${routeParams.id}`,
    locale,
    title: `${announcement.title} - ${announcement.companyName}`,
    description: description || messages.announcementDetails.locationLabel,
    type: "article",
  });
}

export default async function AnnouncementDetailsPage({
  params,
  searchParams,
}: AnnouncementDetailsPageProps) {
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

  if (!ObjectId.isValid(routeParams.id)) {
    notFound();
  }

  const announcements = await getAnnouncementsCollection();
  const announcement = await getPublishedAnnouncementById(routeParams.id);

  if (!announcement) {
    notFound();
  }
  const announcementIdHex = announcement._id.toHexString();
  const canFavorite = Boolean(currentUser?._id);
  let isFavorite = false;
  if (currentUser?._id) {
    const favorites = await getAnnouncementFavoritesCollection();
    isFavorite = Boolean(
      await favorites.findOne(
        { userId: currentUser._id, announcementId: announcement._id },
        { projection: { _id: 1 } },
      ),
    );
  }

  const companies = await getCompaniesCollection();
  const company = await companies.findOne(
    { _id: announcement.companyId },
    {
      projection: {
        _id: 1,
        email: 1,
        createdByUserId: 1,
        isPremium: 1,
        updatedAt: 1,
        "logo.size": 1,
        "background.size": 1,
        "locations.label": 1,
        "locations.addressText": 1,
        "locations.addressParts": 1,
        "locations.email": 1,
        benefits: 1,
      },
    },
  );
  if (!company?._id) {
    notFound();
  }

  const branchIndex =
    announcement.location.mode === JOB_WORK_LOCATION_MODE.BRANCH
      ? resolveBranchIndex({
          branchIndex: announcement.branchIndex,
          locationLabel: announcement.location.label,
          companyLocations: (company.locations ?? []).map((location) => ({
            label: location.label,
            addressText: location.addressText,
          })),
        })
      : null;
  const branchEmail =
    branchIndex !== null ? company.locations?.[branchIndex]?.email?.trim() : undefined;
  const announcementContactPersons = (announcement.contactPersons ?? []).filter(
    (person) =>
      person?.name?.trim() &&
      (Boolean(person?.email?.trim()) || Boolean(person?.phone?.trim())),
  );
  const benefitSet = new Set<string>(COMPANY_BENEFITS);
  const companyBenefits = (company.benefits ?? []).filter(
    (benefit): benefit is CompanyBenefit => benefitSet.has(benefit),
  );
  const canApply = Boolean(
    company.email?.trim() ||
      branchEmail ||
      announcementContactPersons.some((person) => Boolean(person.email?.trim())),
  );
  const storedApplicantCv = currentUser?._id
    ? await (await getUserCvCollection()).findOne(
        { userId: currentUser._id },
        { projection: { _id: 0, filename: 1, size: 1 } },
      )
    : null;
  const canEditAnnouncement =
    Boolean(currentUser?._id) &&
    (
      currentUser?.role === USER_ROLE.ADMIN ||
      company.createdByUserId?.toHexString() === currentUser?._id?.toHexString()
    );

  const companyId = company._id.toHexString();
  const isPremium = company.isPremium === true;
  const logoFallbackColor = getCompanyFallbackColor(companyId);
  const backgroundFallbackGradient = getCompanyFallbackGradient(logoFallbackColor);
  const logoFallbackInitial = getCompanyInitial(announcement.companyName);
  const mediaVersion = company.updatedAt instanceof Date
    ? company.updatedAt.getTime()
    : 0;
  const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
  const logoUrl = company.logo?.size ? withMediaVersion(`/api/companies/${companyId}/logo`) : null;
  const backgroundUrl = company.background?.size
    ? withMediaVersion(`/api/companies/${companyId}/background`)
    : null;
  const contractTypes = (announcement.contractTypes ?? []) as JobContractType[];
  const requirementsSet = new Set<string>(JOB_ANNOUNCEMENT_REQUIREMENTS);
  const requirements = (announcement.requirements ?? []).filter(
    (requirement): requirement is JobAnnouncementRequirement =>
      requirementsSet.has(requirement),
  );
  const tags = announcement.tags ?? [];
  const externalLinks = (announcement.externalLinks ?? [])
    .map((link) => normalizeExternalLink(link))
    .filter((link): link is string => Boolean(link));
  const salaryText = formatSalary({
    salaryFrom: announcement.salaryFrom,
    salaryTo: announcement.salaryTo,
    salaryRatePeriod: announcement.salaryRatePeriod,
    locale,
    periodLabel: messages.announcementDetails.salaryPeriods[announcement.salaryRatePeriod],
    salaryRangeTemplate: messages.announcementCreate.salaryRangeTemplate,
    salaryFromTemplate: messages.announcementCreate.salaryFromTemplate,
    salaryToTemplate: messages.announcementCreate.salaryToTemplate,
  });
  const contractTypeLabels = contractTypes.map(
    (type) => messages.announcementDetails.contractTypes[type],
  );
  const contractTypeSummary =
    contractTypeLabels.length === 0
      ? null
      : contractTypeLabels.length === 1
        ? contractTypeLabels[0]
        : `${contractTypeLabels[0]} ${messages.announcementDetails.contractSummaryAndOthers}`;
  const branchCity =
    branchIndex !== null
      ? normalizeGeocodeAddressParts(company.locations?.[branchIndex]?.addressParts)?.city ?? null
      : null;
  const manualCityCandidate =
    announcement.location.mode === JOB_WORK_LOCATION_MODE.MANUAL
      ? announcement.location.label.trim().split(",")[0]?.trim() || null
      : null;
  const announcementCity = branchCity || manualCityCandidate;

  const safeDescription = sanitizeRichTextHtml(announcement.description);
  const plainDescription = stripHtmlToPlainText(safeDescription);
  const locationPoint = announcement.location?.point?.coordinates ?? null;
  const branchLocation = branchIndex !== null ? company.locations?.[branchIndex] : null;
  const shortBranchAddress = buildShortAddressLabelFromParts({
    parts: branchLocation?.addressParts,
    fallbackLabel: branchLocation?.addressText ?? announcement.location.label,
  });
  const displayLocationLabel =
    branchLocation?.label?.trim() && shortBranchAddress
      ? `${branchLocation.label.trim()} - ${shortBranchAddress}`
      : shortBranchAddress || announcement.location.label;
  const similarRows = await announcements
    .find(
      { isPublished: true, _id: { $ne: announcement._id } },
      {
        projection: {
          _id: 1,
          title: 1,
          companyName: 1,
          companySlug: 1,
          location: 1,
          createdAt: 1,
        },
        sort: { createdAt: -1 },
        limit: 4,
      },
    )
    .toArray();
  const similarAnnouncements = similarRows
    .filter((row) => row._id && row.title && row.companySlug)
    .map((row) => ({
      id: row._id.toHexString(),
      title: row.title,
      companyName: row.companyName,
      companySlug: row.companySlug,
      locationLabel: row.location?.label ?? "-",
    }));
  const announcementUrl = getLocalizedCanonical(
    `/announcements/${announcementIdHex}`,
    locale,
  );
  const companyUrl = getLocalizedCanonical(`/companies/${announcement.companySlug}`, locale);
  const schemaEmploymentType = announcement.employmentType === "full_time" ? "FULL_TIME" : "PART_TIME";
  const baseSalary =
    announcement.salaryFrom !== undefined || announcement.salaryTo !== undefined
      ? {
          "@type": "MonetaryAmount",
          currency: "PLN",
          value: {
            "@type": "QuantitativeValue",
            minValue: announcement.salaryFrom,
            maxValue: announcement.salaryTo,
            unitText: announcement.salaryRatePeriod === "hourly" ? "HOUR" : "MONTH",
          },
        }
      : undefined;
  const jobPostingSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: announcement.title,
    description: plainDescription,
    datePosted: announcement.createdAt?.toISOString(),
    employmentType: schemaEmploymentType,
    jobLocationType:
      announcement.workModel === "remote" ? "TELECOMMUTE" : undefined,
    jobLocation:
      announcement.workModel === "remote"
        ? undefined
        : {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              streetAddress: announcement.location.label,
            },
          },
    baseSalary,
    hiringOrganization: {
      "@type": "Organization",
      name: announcement.companyName,
      url: companyUrl,
    },
    identifier: {
      "@type": "PropertyValue",
      propertyID: "ContainerBoard announcement",
      value: announcementIdHex,
    },
    url: announcementUrl,
  };

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-10 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 pb-28 sm:px-6 sm:pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
        />
        <SmartBackButton
          label={messages.companyDetails.back}
          fallbackHref={withLang("/maps/announcements", locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        />
        <section className="flex flex-wrap items-center gap-3">
          <AnnouncementFavoriteToggle
            announcementId={announcementIdHex}
            locale={locale}
            canFavorite={canFavorite}
            initialIsFavorite={isFavorite}
            messages={messages.announcementDetails}
          />
          <AnnouncementCopyLinkButton
            url={announcementUrl}
            messages={messages.announcementDetails}
          />
          {canEditAnnouncement ? (
            <Link
              href={withLang(`/announcements/${announcementIdHex}/edit`, locale)}
              className="rounded-md border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500"
            >
              {messages.announcementEdit.action}
            </Link>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="relative aspect-[4/1] w-full">
            {backgroundUrl ? (
              <Image
                src={backgroundUrl}
                alt={`${announcement.companyName} background`}
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
                      alt={`${announcement.companyName} logo`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 767px) 48px, (max-width: 1023px) 80px, 96px"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-lg font-semibold text-white md:text-2xl"
                      style={{ backgroundColor: logoFallbackColor }}
                      aria-label={`${announcement.companyName} logo`}
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
                  title={announcement.companyName}
                >
                  {announcement.companyName}
                </p>
                <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
                  {announcement.title}
                </h1>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 text-sm">
            <div className="flex flex-wrap items-stretch justify-center gap-2">
              <div className="rounded-md bg-slate-800/80 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  {messages.announcementDetails.employmentLabel}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-100">
                  {messages.announcementDetails.employmentTypes[announcement.employmentType]}
                </p>
              </div>
              <div className="rounded-md bg-slate-800/80 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  {messages.announcementDetails.workModelLabel}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-100">
                  {messages.announcementDetails.workModels[announcement.workModel]}
                </p>
              </div>
              {contractTypeSummary ? (
                <div className="rounded-md bg-slate-800/80 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    {messages.announcementDetails.contractLabel}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-100">
                    {contractTypeSummary}
                  </p>
                </div>
              ) : null}
              {announcementCity ? (
                <div className="rounded-md border border-amber-600/70 bg-amber-500/15 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-amber-300/90">
                    {messages.announcementDetails.locationLabel}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-amber-200">
                    {announcementCity}
                  </p>
                </div>
              ) : null}
              {salaryText ? (
                <div className="rounded-md border border-emerald-700/70 bg-emerald-950/35 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-emerald-300/90">
                    {messages.announcementDetails.salaryLabel}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-200">{salaryText}</p>
                </div>
              ) : null}
            </div>
            {tags.length > 0 ? (
              <p>
                <span className="text-slate-400">{messages.announcementDetails.tagsLabel}: </span>
                <span className="text-slate-100">{tags.join(", ")}</span>
              </p>
            ) : null}
            {externalLinks.length > 0 ? (
              <div>
                <p className="text-slate-400">{messages.announcementDetails.externalLinksLabel}: </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {externalLinks.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-sky-300 hover:border-sky-500"
                    >
                      {messages.announcementDetails.openExternalLink}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {announcementContactPersons.length > 0 ? (
              <div>
                <p className="text-slate-400">{messages.announcementDetails.contactPeopleLabel}: </p>
                <div className="mt-2 grid gap-2">
                  {announcementContactPersons.map((person, index) => (
                    <article
                      key={`${person.email ?? person.phone ?? person.name}-${index}`}
                      className="rounded-md border border-slate-800 bg-slate-950/70 p-2"
                    >
                      <p className="text-slate-100">{person.name}</p>
                      {person.email ? (
                        <p className="text-xs text-slate-300">{person.email}</p>
                      ) : null}
                      {person.phone ? (
                        <p className="text-xs text-slate-400">{person.phone}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

      <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">{announcement.title}</h2>
        <div className="grid gap-2 text-sm text-slate-200 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p+p]:mt-3 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal">
          {safeDescription ? (
            <div dangerouslySetInnerHTML={{ __html: safeDescription }} />
          ) : (
            <p className="text-slate-400">-</p>
          )}
        </div>
        {contractTypeLabels.length > 0 ? (
          <p className="text-sm">
            <span className="text-slate-400">{messages.announcementDetails.contractLabel}: </span>
            <span className="text-slate-100">{contractTypeLabels.join(", ")}</span>
          </p>
        ) : null}
        {requirements.length > 0 ? (
          <div>
            <p className="text-slate-400">{messages.announcementDetails.requirementsLabel}: </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {requirements.map((requirement) => (
                <li
                  key={requirement}
                  className="inline-flex items-center rounded-md border border-sky-400/35 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100"
                >
                  {messages.announcementCreate.requirementsOptions[requirement]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {companyBenefits.length > 0 ? (
          <div>
            <p className="text-slate-400">{messages.announcementDetails.benefitsLabel}: </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {companyBenefits.map((benefit) => (
                <li
                  key={benefit}
                  className="inline-flex items-center rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100"
                >
                  {messages.companyCreate.benefitsOptions[benefit]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <AnnouncementApplyForm
          announcementId={announcementIdHex}
          canApply={canApply}
          defaultApplicant={
            currentUser
              ? {
                  name: currentUser.name,
                  email: currentUser.email,
                  phone: currentUser.phone ?? "",
                }
              : undefined
          }
          storedCv={
            storedApplicantCv
              ? {
                  filename: storedApplicantCv.filename,
                  size: storedApplicantCv.size,
                }
              : null
          }
          messages={messages.announcementDetails}
        />
      </section>

      {locationPoint ? (
        <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-slate-100">
            {messages.announcementDetails.locationMapTitle}
          </h2>
          <AnnouncementLocationMap
            point={locationPoint}
            label={displayLocationLabel}
          />
        </section>
      ) : null}

      <p className="pl-2 text-sm text-slate-300">
        <span className="text-slate-400">{messages.announcementDetails.companyCardTitle}: </span>
        <Link
          href={withLang(`/companies/${announcement.companySlug}`, locale)}
          className="font-medium text-sky-300 hover:text-sky-200"
        >
          {announcement.companyName}
        </Link>
      </p>

      <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-slate-100">
          {messages.announcementDetails.similarAnnouncementsTitle}
        </h2>
        {similarAnnouncements.length > 0 ? (
          <div className="grid gap-2">
            {similarAnnouncements.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
              >
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {messages.announcementDetails.companyLabel}: {item.companyName}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {messages.announcementDetails.locationLabel}: {item.locationLabel}
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <Link
                    href={withLang(`/announcements/${item.id}`, locale)}
                    className="text-sky-300 hover:text-sky-200"
                  >
                    {messages.announcementDetails.openAnnouncement}
                  </Link>
                  <Link
                    href={withLang(`/companies/${item.companySlug}`, locale)}
                    className="text-slate-300 hover:text-slate-200"
                  >
                    {messages.announcementDetails.goToCompany}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            {messages.announcementDetails.similarAnnouncementsEmpty}
          </p>
        )}
      </section>

      <div>
        <Link
          href={withLang("/maps/announcements", locale)}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
        >
          {messages.announcementDetails.backToMap}
        </Link>
      </div>
      </main>
    </section>
  );
}

