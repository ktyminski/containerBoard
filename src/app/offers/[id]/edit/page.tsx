import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NewOfferForm, type OfferFormValues } from "@/components/new-offer-form";
import { SmartBackButton } from "@/components/smart-back-button";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getCurrentUserFromToken } from "@/lib/auth-user";
import { getCompaniesCollection } from "@/lib/companies";
import {
  getLocaleFromRequest,
  getMessages,
  LOCALE_COOKIE_NAME,
  withLang,
} from "@/lib/i18n";
import { normalizeOfferType } from "@/lib/offer-type";
import { getOffersCollection } from "@/lib/offers";
import { USER_ROLE } from "@/lib/user-roles";

type EditOfferPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function resolveBranchId(input: {
  companyId: string;
  locationLabel: string;
  locationPoint: [number, number] | null;
  companyLocations: Array<{ label: string; addressText: string; point: [number, number] }>;
}): string {
  const byLabel = input.companyLocations.findIndex(
    (location) => `${location.label} - ${location.addressText}` === input.locationLabel,
  );
  if (byLabel >= 0) {
    return `${input.companyId}:${byLabel}`;
  }

  if (input.locationPoint) {
    const point = input.locationPoint;
    const byPoint = input.companyLocations.findIndex((location) => {
      const [lngA, latA] = location.point;
      const [lngB, latB] = point;
      return Math.abs(lngA - lngB) < 0.000001 && Math.abs(latA - latB) < 0.000001;
    });
    if (byPoint >= 0) {
      return `${input.companyId}:${byPoint}`;
    }
  }

  return input.companyLocations.length > 0 ? `${input.companyId}:0` : "";
}

export default async function EditOfferPage({
  params,
  searchParams,
}: EditOfferPageProps) {
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
    redirect(withLang(`/login?next=/offers/${routeParams.id}/edit`, locale));
  }

  const currentUser = await getCurrentUserFromToken(token);
  if (!currentUser?._id) {
    redirect(withLang(`/login?next=/offers/${routeParams.id}/edit`, locale));
  }

  const offerId = new ObjectId(routeParams.id);
  const offers = await getOffersCollection();
  const offer = await offers.findOne(
    { _id: offerId },
    {
      projection: {
        _id: 1,
        companyId: 1,
        offerType: 1,
        title: 1,
        description: 1,
        tags: 1,
        externalLinks: 1,
        locationLabel: 1,
        point: 1,
      },
    },
  );
  if (!offer?._id) {
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
                phone: 1,
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
                phone: 1,
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
    availableCompanies.some((company) => company._id?.equals(offer.companyId));
  if (!canEdit) {
    redirect(withLang(`/offers/${routeParams.id}`, locale));
  }

  const serializedCompanies = availableCompanies
    .filter((company) => company._id)
    .map((company) => {
      const companyId = company._id.toHexString();
      const mediaVersion = company.updatedAt instanceof Date
        ? company.updatedAt.getTime()
        : 0;
      const withMediaVersion = (url: string) => `${url}?v=${mediaVersion}`;
      return {
        id: companyId,
        name: company.name,
        email: company.email ?? null,
        phone: company.phone ?? null,
        logoUrl: company.logo?.size ? withMediaVersion(`/api/companies/${companyId}/logo`) : null,
        backgroundUrl: company.background?.size
          ? withMediaVersion(`/api/companies/${companyId}/background`)
          : null,
        branches: (company.locations ?? []).map((location, index) => ({
          id: `${companyId}:${index}`,
          label: location.label,
          addressText: location.addressText,
          addressParts: location.addressParts ?? null,
          email: location.email ?? null,
          phone: location.phone ?? null,
          point: location.point.coordinates as [number, number],
        })),
      };
    })
    .map((company) => ({
      id: company.id,
      name: company.name,
      email: company.email,
      phone: company.phone,
      logoUrl: company.logoUrl,
      backgroundUrl: company.backgroundUrl,
      branches: company.branches.map((branch) => ({
        id: branch.id,
        label: branch.label,
        addressText: branch.addressText,
        addressParts: branch.addressParts ?? null,
        email: branch.email,
        phone: branch.phone,
      })),
    }));

  const selectedCompany = availableCompanies.find((company) =>
    company._id?.equals(offer.companyId),
  );
  if (!selectedCompany?._id) {
    redirect(withLang(`/offers/${routeParams.id}`, locale));
  }

  const companyId = selectedCompany._id.toHexString();
  const branchId = resolveBranchId({
    companyId,
    locationLabel: offer.locationLabel,
    locationPoint: offer.point?.coordinates ?? null,
    companyLocations: (selectedCompany.locations ?? []).map((location) => ({
      label: location.label,
      addressText: location.addressText,
      point: location.point.coordinates,
    })),
  });

  const initialValues: OfferFormValues = {
    companyId,
    offerType: normalizeOfferType(offer.offerType),
    branchId,
    title: offer.title,
    description: offer.description,
    tags: offer.tags ?? [],
    externalLinks: offer.externalLinks ?? [],
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
          fallbackHref={withLang(`/offers/${offer._id.toHexString()}`, locale)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-slate-500"
        />
        <header>
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">
            {messages.offerEdit.title}
          </h1>
          <p className="mt-2 text-sm text-slate-300">{messages.offerEdit.subtitle}</p>
          <p className="mt-1 text-xs text-slate-400">{messages.companyCreate.requiredFieldsHint}</p>
          <p className="mt-1 text-sm text-slate-400">{offer.title}</p>
        </header>

        <NewOfferForm
          locale={locale}
          messages={messages.offerCreate}
          descriptionEditorLabels={messages.announcementCreate.descriptionEditor}
          companies={serializedCompanies}
          mode="edit"
          initialValues={initialValues}
          submitEndpoint={`/api/offers/${offer._id.toHexString()}`}
          submitMethod="PATCH"
          submitLabel={messages.offerEdit.submit}
          successMessage={messages.offerEdit.success}
          submitErrorMessage={messages.offerEdit.error}
          backHref={withLang(`/offers/${offer._id.toHexString()}`, locale)}
          backLabel={messages.offerEdit.backToOffer}
        />
      </main>
    </section>
  );
}

