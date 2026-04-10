import type { CompanyBenefit } from "@/lib/company-benefits";
import type { GeocodeAddressParts } from "@/lib/geocode-address";
import type {
  JobContractType,
  JobAnnouncementRequirement,
  JobEmploymentType,
  JobRatePeriod,
  JobWorkLocationMode,
  JobWorkModel,
} from "@/lib/job-announcement";

export type JobAnnouncementCompany = {
  id: string;
  name: string;
  email?: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  benefits: CompanyBenefit[];
  branches: Array<{
    id: string;
    label: string;
    addressText: string;
    addressParts?: GeocodeAddressParts | null;
    email?: string;
    lat: number;
    lng: number;
  }>;
};

export type JobAnnouncementFormValues = {
  contactPersons: Array<{
    name: string;
    phone: string;
    email: string;
  }>;
  companyId: string;
  workLocationMode: JobWorkLocationMode;
  branchId: string;
  manualLocationText: string;
  mapLat: number | null;
  mapLng: number | null;
  title: string;
  description: string;
  workModel: JobWorkModel;
  employmentType: JobEmploymentType;
  contractTypes: JobContractType[];
  salaryRatePeriod: JobRatePeriod;
  salaryFrom: string;
  salaryTo: string;
  tags: string[];
  requirements: JobAnnouncementRequirement[];
  externalLinks: string[];
  useCompanyOrBranchEmail: boolean;
  applicationEmail: string;
};

export type JobAnnouncementContactDraft = {
  name: string;
  email: string;
  phone: string;
};
