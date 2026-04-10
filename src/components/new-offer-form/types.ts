import type { JobDescriptionEditorLabels } from "@/components/job-description-editor";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { OfferType } from "@/lib/offer-type";

export type OfferCompany = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  branches: Array<{
    id: string;
    label: string;
    addressText: string;
    addressParts?: GeocodeAddressParts | null;
    email: string | null;
    phone: string | null;
  }>;
};

export type OfferFormValues = {
  companyId: string;
  offerType: OfferType;
  branchId: string;
  title: string;
  description: string;
  tags: string[];
  externalLinks: string[];
};

export type NewOfferFormProps = {
  locale: AppLocale;
  messages: AppMessages["offerCreate"];
  descriptionEditorLabels: JobDescriptionEditorLabels;
  companies: OfferCompany[];
  mode?: "create" | "edit";
  initialValues?: Partial<OfferFormValues>;
  submitEndpoint?: string;
  submitMethod?: "POST" | "PATCH";
  submitLabel?: string;
  successMessage?: string;
  submitErrorMessage?: string;
  backHref?: string;
  backLabel?: string;
};
