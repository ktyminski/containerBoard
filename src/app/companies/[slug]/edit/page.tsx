import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import { SmartBackButton } from "@/components/smart-back-button";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { NewCompanyForm } from "@/components/new-company-form";
import { USER_ROLE } from "@/lib/user-roles";
import type { NewCompanyFormValues } from "@/components/new-company-form/types";
import { normalizeCompanyOperatingArea } from "@/lib/company-operating-area";

type EditCompanyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function EditCompanyPage({ params, searchParams }: EditCompanyPageProps) {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang(`/login?next=/companies/${routeParams.slug}/edit`, locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang(`/login?next=/companies/${routeParams.slug}/edit`, locale));
  }

  const companies = await getCompaniesCollection();
  const company = await companies.findOne(
    { slug: routeParams.slug },
    {
      projection: {
        _id: 1,
        createdByUserId: 1,
        name: 1,
        description: 1,
        operatingArea: 1,
        operatingAreaDetails: 1,
        nip: 1,
        phone: 1,
        email: 1,
        website: 1,
        facebookUrl: 1,
        instagramUrl: 1,
        linkedinUrl: 1,
        "locations.label": 1,
        "locations.addressText": 1,
        "locations.addressParts": 1,
        "locations.phone": 1,
        "locations.email": 1,
        "locations.point": 1,
        "locations.photos.size": 1,
        "locations.photos.filename": 1,
        "logo.filename": 1,
        "logo.size": 1,
        "background.filename": 1,
        "background.size": 1,
        updatedAt: 1,
      },
    },
  );

  if (!company?._id) {
    redirect(withLang("/list", locale));
  }

  const isAdmin = currentUser.role === USER_ROLE.ADMIN;
  const isOwner =
    company.createdByUserId &&
    company.createdByUserId.toHexString() === currentUser._id.toHexString();
  if (!isAdmin && !isOwner) {
    redirect(withLang(`/companies/${routeParams.slug}`, locale));
  }

  const initialBranches = (company.locations ?? []).map((location) => {
    const point = location?.point?.coordinates;
    const hasValidPoint = isValidPoint(point);
    return {
      label: location?.label ?? "",
      addressText: location?.addressText ?? "",
      addressParts: location?.addressParts ?? null,
      lat: hasValidPoint ? String(point[1]) : "",
      lng: hasValidPoint ? String(point[0]) : "",
      useCustomDetails: Boolean(location?.phone || location?.email),
      phone: location?.phone ?? "",
      email: location?.email ?? "",
    };
  });

  const initialValues: NewCompanyFormValues = {
    name: company.name,
    description: company.description,
    operatingArea: normalizeCompanyOperatingArea(company.operatingArea),
    operatingAreaDetails: company.operatingAreaDetails ?? "",
    nip: company.nip ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
    facebookUrl: company.facebookUrl ?? "",
    instagramUrl: company.instagramUrl ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    branches: initialBranches,
  };
  const companyId = company._id.toHexString();
  const mediaVersion = company.updatedAt instanceof Date
    ? company.updatedAt.getTime()
    : 0;
  const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
  const initialLogoUrl =
    company.logo?.data || company.logo?.size
      ? withMediaVersion(`/api/companies/${companyId}/logo`)
      : null;
  const initialBackgroundUrl =
    company.background?.data || company.background?.size
      ? withMediaVersion(`/api/companies/${companyId}/background`)
      : null;
  const initialLogoBytes = company.logo?.size ?? 0;
  const initialBackgroundBytes = company.background?.size ?? 0;
  const initialBranchPhotosBytes = (company.locations ?? []).reduce((sum, location) => {
    const bytes = (location?.photos ?? []).reduce((locationSum, photo) => {
      const size = photo?.size;
      if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
        return locationSum;
      }
      return locationSum + size;
    }, 0);
    return sum + bytes;
  }, 0);

  return (
    <section className="bg-neutral-200/90">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <SmartBackButton
          label={messages.companyDetails.back}
          hideWhenNoHistory
          className="inline-flex w-fit items-center gap-2 rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-500"
        />
        <header>
          <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
            {messages.companyDetails.editCompany}
          </h1>
          <p className="mt-1 text-xs text-neutral-700">{messages.companyCreate.requiredFieldsHint}</p>
        </header>

        <NewCompanyForm
          locale={locale}
          messages={messages.companyCreate}
          initialValues={initialValues}
          initialLogoUrl={initialLogoUrl}
          initialBackgroundUrl={initialBackgroundUrl}
          initialLogoBytes={initialLogoBytes}
          initialBackgroundBytes={initialBackgroundBytes}
          initialBranchPhotosBytes={initialBranchPhotosBytes}
          submitEndpoint={`/api/companies/${company._id.toHexString()}`}
          httpMethod="PATCH"
          resetOnSuccess={false}
          successMessage={messages.companyDetails.updateSuccess}
          successRedirectTo={withLang(`/companies/${routeParams.slug}`, locale)}
        />
      </main>
    </section>
  );
}


