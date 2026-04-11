import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { UserSettingsAssignedCompanies } from "@/components/user-settings-assigned-companies";
import { UserSettingsAccountSection } from "@/components/user-settings-account-section";
import { UserSettingsDangerZone } from "@/components/user-settings-danger-zone";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getAnnouncementFavoritesCollection } from "@/lib/announcement-favorites";
import { getAnnouncementsCollection } from "@/lib/announcements";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { USER_ROLE } from "@/lib/user-roles";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatBranchLocationLabel(input: {
  label?: string;
  addressText?: string;
}): string | null {
  const label = input.label?.trim();
  const addressText = input.addressText?.trim();
  if (!label || !addressText) {
    return null;
  }
  return `${label} - ${addressText}`;
}

function resolveAnnouncementLocationMeta(input: {
  branchIndex: number | undefined;
  locationLabel: string;
  companyLocations: Array<{ fullLabel: string; city?: string; country?: string }>;
}): { city?: string; country?: string } | undefined {
  const branchIndex = input.branchIndex;
  if (typeof branchIndex === "number" && Number.isInteger(branchIndex) && branchIndex >= 0) {
    const byIndex = input.companyLocations[branchIndex];
    if (byIndex) {
      return {
        city: byIndex.city,
        country: byIndex.country,
      };
    }
  }

  const locationLabel = input.locationLabel.trim();
  if (!locationLabel) {
    return undefined;
  }

  const matched = input.companyLocations.find(
    (location) => location.fullLabel === locationLabel,
  );
  if (!matched) {
    return undefined;
  }

  return {
    city: matched.city,
    country: matched.country,
  };
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang("/login?next=/settings", locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang("/login?next=/settings", locale));
  }
  const favorites = await getAnnouncementFavoritesCollection();
  const favoriteRows = await favorites
    .find(
      { userId: currentUser._id },
      {
        projection: { announcementId: 1, createdAt: 1 },
        sort: { createdAt: -1 },
        limit: 500,
      },
    )
    .toArray();

  const announcementIds = favoriteRows.map((favorite) => favorite.announcementId);
  const favoriteAnnouncementsRaw =
    announcementIds.length > 0
      ? await (await getAnnouncementsCollection())
          .find(
            { _id: { $in: announcementIds }, isPublished: true },
            {
              projection: {
                _id: 1,
                title: 1,
                companyId: 1,
                companyName: 1,
                companySlug: 1,
                branchIndex: 1,
                "location.label": 1,
              },
            },
          )
          .toArray()
      : [];
  const favoriteAnnouncementsById = new Map(
    favoriteAnnouncementsRaw.map((announcement) => [announcement._id.toHexString(), announcement]),
  );

  const favoriteAnnouncementCompanyIds = Array.from(
    new Set(favoriteAnnouncementsRaw.map((announcement) => announcement.companyId.toHexString())),
  );

  const companiesForFavorites =
    favoriteAnnouncementCompanyIds.length > 0
      ? await (await getCompaniesCollection())
          .find(
            {
              _id: {
                $in: favoriteAnnouncementCompanyIds.map((companyId) => new ObjectId(companyId)),
              },
            },
            {
              projection: {
                _id: 1,
                "locations.label": 1,
                "locations.addressText": 1,
                "locations.addressParts.city": 1,
                "locations.addressParts.country": 1,
              },
            },
          )
          .toArray()
      : [];

  const favoriteCompanyLocationMetaById = new Map<
    string,
    Array<{ fullLabel: string; city?: string; country?: string }>
  >();
  for (const company of companiesForFavorites) {
    const companyId = company._id.toHexString();
    const locationMeta: Array<{ fullLabel: string; city?: string; country?: string }> = [];

    for (const location of company.locations ?? []) {
      const fullLabel = formatBranchLocationLabel({
        label: location.label,
        addressText: location.addressText,
      });
      if (!fullLabel) {
        continue;
      }

      locationMeta.push({
        fullLabel,
        city: location.addressParts?.city?.trim() || undefined,
        country: location.addressParts?.country?.trim() || undefined,
      });
    }

    favoriteCompanyLocationMetaById.set(companyId, locationMeta);
  }

  const favoriteAnnouncements: Array<{
    id: string;
    title: string;
    companyName: string;
    companySlug: string;
    locationLabel: string;
    locationCity?: string;
    locationCountry?: string;
  }> = [];

  for (const favorite of favoriteRows) {
    const announcement = favoriteAnnouncementsById.get(
      favorite.announcementId.toHexString(),
    );
    if (!announcement?._id) {
      continue;
    }

    const locationMeta = resolveAnnouncementLocationMeta({
      branchIndex: announcement.branchIndex,
      locationLabel: announcement.location?.label ?? "",
      companyLocations:
        favoriteCompanyLocationMetaById.get(announcement.companyId.toHexString()) ?? [],
    });

    favoriteAnnouncements.push({
      id: announcement._id.toHexString(),
      title: announcement.title,
      companyName: announcement.companyName,
      companySlug: announcement.companySlug,
      locationLabel: announcement.location?.label ?? "-",
      locationCity: locationMeta?.city,
      locationCountry: locationMeta?.country,
    });
  }

  const shouldShowAssignedCompanies = currentUser.role !== USER_ROLE.ADMIN;
  const assignedCompanies = shouldShowAssignedCompanies
    ? await (await getCompaniesCollection())
        .find(
          { createdByUserId: currentUser._id },
          {
            projection: { _id: 1, name: 1, slug: 1, isBlocked: 1 },
            sort: { name: 1 },
            limit: 500,
          },
        )
        .toArray()
    : [];
  const hasBlockedAssignedCompany = assignedCompanies.some(
    (company) => company.isBlocked === true,
  );
  const shouldRenderAssignedCompaniesSection =
    shouldShowAssignedCompanies && assignedCompanies.length > 0;
  const shouldShowBlockedNotice =
    currentUser.isBlocked === true || hasBlockedAssignedCompany;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{messages.settingsPage.title}</h1>
        <p className="mt-2 text-sm text-slate-300">{messages.settingsPage.subtitle}</p>
      </header>

      {shouldShowBlockedNotice ? (
        <section className="rounded-xl border border-rose-700/70 bg-rose-950/30 p-5">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-rose-200">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-600 bg-rose-500/10 text-sm font-bold">
              !
            </span>
            {messages.settingsPage.blockedTitle}
          </h2>
          {currentUser.isBlocked ? (
            <p className="mt-2 text-sm text-rose-100/90">
              {messages.settingsPage.blockedAccountNotice}
            </p>
          ) : null}
          {hasBlockedAssignedCompany ? (
            <p className="mt-2 text-sm text-rose-100/90">
              {messages.settingsPage.blockedCompanyNotice}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-medium text-rose-100">
            {messages.settingsPage.blockedContactAdmin}
          </p>
        </section>
      ) : null}

      <UserSettingsAccountSection
        locale={locale}
        messages={messages.settingsPage}
        user={{
          name: currentUser.name,
          email: currentUser.email,
          phone: currentUser.phone ?? "",
          canChangePassword: currentUser.sessionAuthProvider === "local",
          isEmailVerified:
            currentUser.authProvider !== "local" || currentUser.isEmailVerified !== false,
        }}
        favoriteAnnouncements={favoriteAnnouncements}
      />

      {shouldRenderAssignedCompaniesSection ? (
        <UserSettingsAssignedCompanies
          locale={locale}
          messages={messages.settingsPage}
          companies={assignedCompanies.map((company) => ({
            id: company._id.toHexString(),
            name: company.name,
            slug: company.slug,
            isBlocked: company.isBlocked === true,
          }))}
        />
      ) : null}

      {currentUser.role !== USER_ROLE.ADMIN ? (
        <UserSettingsDangerZone locale={locale} messages={messages.settingsPage} />
      ) : null}
    </main>
  );
}
