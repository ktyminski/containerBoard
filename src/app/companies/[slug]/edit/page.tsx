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
        category: 1,
        communicationLanguages: 1,
        operatingArea: 1,
        operatingAreaDetails: 1,
        nip: 1,
        phone: 1,
        email: 1,
        website: 1,
        facebookUrl: 1,
        instagramUrl: 1,
        linkedinUrl: 1,
        benefits: 1,
        specializations: 1,
        "locations.label": 1,
        "locations.addressText": 1,
        "locations.addressParts": 1,
        "locations.note": 1,
        "locations.phone": 1,
        "locations.email": 1,
        "locations.category": 1,
        "locations.point": 1,
        "locations.photos.size": 1,
        "locations.photos.filename": 1,
        "photos.size": 1,
        "logo.filename": 1,
        "logo.size": 1,
        "background.filename": 1,
        "background.size": 1,
        updatedAt: 1,
      },
    },
  );

  if (!company?._id) {
    redirect(withLang("/maps", locale));
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
      note: location?.note ?? "",
      lat: hasValidPoint ? String(point[1]) : "",
      lng: hasValidPoint ? String(point[0]) : "",
      useCustomDetails: Boolean(location?.phone || location?.email || location?.category),
      phone: location?.phone ?? "",
      email: location?.email ?? "",
      category: location?.category ?? "",
    };
  });

  const initialValues: NewCompanyFormValues = {
    name: company.name,
    description: company.description,
    communicationLanguages: company.communicationLanguages ?? [],
    operatingArea: normalizeCompanyOperatingArea(company.operatingArea),
    operatingAreaDetails: company.operatingAreaDetails ?? "",
    nip: company.nip ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
    facebookUrl: company.facebookUrl ?? "",
    instagramUrl: company.instagramUrl ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    benefits: company.benefits ?? [],
    specializations: company.specializations ?? [],
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
  const initialPhotoUrls = (company.photos ?? []).map(
    (_photo, index) => withMediaVersion(`/api/companies/${companyId}/photos/${index}`),
  );
  const initialLogoBytes = company.logo?.size ?? 0;
  const initialBackgroundBytes = company.background?.size ?? 0;
  const initialPhotoBytes = (company.photos ?? []).map((photo) => photo?.size ?? 0);
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
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-28 top-10 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute right-[-5rem] top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <SmartBackButton
          label={messages.companyDetails.back}
          hideWhenNoHistory
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        />
        <header>
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
            {messages.companyDetails.editCompany}
          </h1>
          <p className="mt-1 text-xs text-slate-400">{messages.companyCreate.requiredFieldsHint}</p>
        </header>

        <NewCompanyForm
          locale={locale}
          messages={messages.companyCreate}
          initialValues={initialValues}
          initialLogoUrl={initialLogoUrl}
          initialBackgroundUrl={initialBackgroundUrl}
          initialPhotoUrls={initialPhotoUrls}
          initialLogoBytes={initialLogoBytes}
          initialBackgroundBytes={initialBackgroundBytes}
          initialPhotoBytes={initialPhotoBytes}
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

