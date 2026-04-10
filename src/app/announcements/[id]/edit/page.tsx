import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  NewJobAnnouncementForm,
  type JobAnnouncementFormValues,
} from "@/components/new-job-announcement-form";
import { SmartBackButton } from "@/components/smart-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getAnnouncementsCollection } from "@/lib/announcements";
import { getCompaniesCollection } from "@/lib/companies";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import {
  JOB_ANNOUNCEMENT_REQUIREMENTS,
  JOB_WORK_LOCATION_MODE,
  type JobAnnouncementRequirement,
} from "@/lib/job-announcement";
import { USER_ROLE } from "@/lib/user-roles";

type EditAnnouncementPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveBranchId(input: {
  companyId: string;
  branchIndex?: number;
  locationLabel: string;
  locationPoint: [number, number] | null;
  companyLocations: Array<{ label: string; addressText: string; point: [number, number] }>;
}): string {
  if (
    typeof input.branchIndex === "number" &&
    Number.isInteger(input.branchIndex) &&
    input.branchIndex >= 0 &&
    input.branchIndex < input.companyLocations.length
  ) {
    return `${input.companyId}:${input.branchIndex}`;
  }

  const byLabel = input.companyLocations.findIndex(
    (location) => `${location.label} - ${location.addressText}` === input.locationLabel,
  );
  if (byLabel >= 0) {
    return `${input.companyId}:${byLabel}`;
  }

  if (input.locationPoint) {
    const byPoint = input.companyLocations.findIndex((location) => {
      const [lngA, latA] = location.point;
      const [lngB, latB] = input.locationPoint!;
      return Math.abs(lngA - lngB) < 0.000001 && Math.abs(latA - latB) < 0.000001;
    });
    if (byPoint >= 0) {
      return `${input.companyId}:${byPoint}`;
    }
  }

  return input.companyLocations.length > 0 ? `${input.companyId}:0` : "";
}

export default async function EditAnnouncementPage({
  params,
  searchParams,
}: EditAnnouncementPageProps) {
  const routeParams = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const locale = getLocaleFromRequest({
    params: query,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  });
  const messages = getMessages(locale);

  if (!ObjectId.isValid(routeParams.id)) {
    notFound();
  }

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect(withLang(`/login?next=/announcements/${routeParams.id}/edit`, locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang(`/login?next=/announcements/${routeParams.id}/edit`, locale));
  }

  const announcementId = new ObjectId(routeParams.id);
  const announcements = await getAnnouncementsCollection();
  const announcement = await announcements.findOne(
    { _id: announcementId },
    {
      projection: {
        _id: 1,
        companyId: 1,
        title: 1,
        description: 1,
        workModel: 1,
        employmentType: 1,
        contractTypes: 1,
        salaryRatePeriod: 1,
        salaryFrom: 1,
        salaryTo: 1,
        tags: 1,
        requirements: 1,
        externalLinks: 1,
        contactPersons: 1,
        applicationEmail: 1,
        location: 1,
        branchIndex: 1,
      },
    },
  );

  if (!announcement?._id) {
    notFound();
  }

  const companies = await getCompaniesCollection();
  const availableCompanies =
    currentUser.role === USER_ROLE.ADMIN
      ? await companies
          .find(
            {},
            {
              projection: {
                _id: 1,
                name: 1,
                email: 1,
                benefits: 1,
                locations: 1,
                createdByUserId: 1,
                updatedAt: 1,
                "logo.size": 1,
                "background.size": 1,
              },
              sort: { name: 1 },
              limit: 500,
            },
          )
          .toArray()
      : await companies
          .find(
            { createdByUserId: currentUser._id },
            {
              projection: {
                _id: 1,
                name: 1,
                email: 1,
                benefits: 1,
                locations: 1,
                createdByUserId: 1,
                updatedAt: 1,
                "logo.size": 1,
                "background.size": 1,
              },
              sort: { name: 1 },
              limit: 100,
            },
          )
          .toArray();

  const canEdit =
    currentUser.role === USER_ROLE.ADMIN ||
    availableCompanies.some((company) => company._id?.equals(announcement.companyId));
  if (!canEdit) {
    redirect(withLang(`/announcements/${routeParams.id}`, locale));
  }

  const serializedCompanies = availableCompanies
    .filter((company) => company._id)
    .map((company) => ({
      id: company._id.toHexString(),
      name: company.name,
      email: company.email ?? "",
      logoUrl: company.logo?.size
        ? `/api/companies/${company._id.toHexString()}/logo?v=${
            company.updatedAt instanceof Date ? company.updatedAt.getTime() : 0
          }`
        : null,
      backgroundUrl: company.background?.size
        ? `/api/companies/${company._id.toHexString()}/background?v=${
            company.updatedAt instanceof Date ? company.updatedAt.getTime() : 0
          }`
        : null,
      benefits: company.benefits ?? [],
      branches: (company.locations ?? []).map((location, index) => ({
        id: `${company._id.toHexString()}:${index}`,
        label: location.label,
        addressText: location.addressText,
        addressParts: location.addressParts ?? null,
        email: location.email ?? "",
        lat: location.point.coordinates[1],
        lng: location.point.coordinates[0],
      })),
    }));

  const selectedCompany = serializedCompanies.find(
    (company) => company.id === announcement.companyId.toHexString(),
  );
  if (!selectedCompany) {
    redirect(withLang(`/announcements/${routeParams.id}`, locale));
  }

  const point = announcement.location?.point?.coordinates ?? null;
  const manualLocationText =
    announcement.location?.mode === JOB_WORK_LOCATION_MODE.MANUAL
      ? announcement.location.label
      : "";
  const branchId =
    announcement.location?.mode === JOB_WORK_LOCATION_MODE.BRANCH
      ? resolveBranchId({
          companyId: selectedCompany.id,
          branchIndex: announcement.branchIndex,
          locationLabel: announcement.location.label,
          locationPoint: point,
          companyLocations: selectedCompany.branches.map((branch) => ({
            label: branch.label,
            addressText: branch.addressText,
            point: [branch.lng, branch.lat],
          })),
        })
      : selectedCompany.branches[0]?.id ?? "";

  const initialValues: JobAnnouncementFormValues = {
    companyId: selectedCompany.id,
    workLocationMode: announcement.location?.mode ?? JOB_WORK_LOCATION_MODE.BRANCH,
    branchId,
    manualLocationText,
    mapLat: point ? point[1] : null,
    mapLng: point ? point[0] : null,
    title: announcement.title,
    description: announcement.description,
    workModel: announcement.workModel,
    employmentType: announcement.employmentType,
    contractTypes: announcement.contractTypes ?? [],
    salaryRatePeriod: announcement.salaryRatePeriod,
    salaryFrom:
      typeof announcement.salaryFrom === "number" ? String(announcement.salaryFrom) : "",
    salaryTo: typeof announcement.salaryTo === "number" ? String(announcement.salaryTo) : "",
    tags: announcement.tags ?? [],
    requirements: (announcement.requirements ?? []).filter(
      (requirement): requirement is JobAnnouncementRequirement =>
        JOB_ANNOUNCEMENT_REQUIREMENTS.includes(requirement),
    ),
    externalLinks: announcement.externalLinks ?? [],
    contactPersons: (announcement.contactPersons ?? []).map((person) => ({
      name: person.name ?? "",
      phone: person.phone ?? "",
      email: person.email ?? "",
    })),
    useCompanyOrBranchEmail: !announcement.applicationEmail?.trim(),
    applicationEmail: announcement.applicationEmail?.trim() ?? "",
  };

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
          fallbackHref={withLang(`/announcements/${announcement._id.toHexString()}`, locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        />
        <header>
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
            {messages.announcementEdit.title}
          </h1>
          <p className="mt-2 text-sm text-slate-300">{messages.announcementEdit.subtitle}</p>
          <p className="mt-1 text-xs text-slate-400">{messages.companyCreate.requiredFieldsHint}</p>
          <p className="mt-1 text-sm text-slate-400">{announcement.title}</p>
        </header>

        <NewJobAnnouncementForm
          locale={locale}
          messages={messages.announcementCreate}
          companyBenefitLabels={messages.companyCreate.benefitsOptions}
          companyBenefitsTitle={messages.announcementDetails.benefitsLabel}
          companies={serializedCompanies}
          mode="edit"
          initialValues={initialValues}
          submitEndpoint={`/api/announcements/${announcement._id.toHexString()}`}
          submitMethod="PATCH"
          announcementId={announcement._id.toHexString()}
        submitLabel={messages.announcementEdit.submit}
        successMessage={messages.announcementEdit.success}
        submitErrorMessage={messages.announcementEdit.error}
      />
      </main>
    </section>
  );
}

