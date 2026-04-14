import type { CompanyVerificationStatus } from "@/lib/company-verification";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import type { CompanySpecialization } from "@/types/company-specialization";

export type CompanyMapItem = {
  id: string;
  name: string;
  slug: string;
  isPremium: boolean;
  locationCity?: string;
  communicationLanguages?: CompanyCommunicationLanguage[];
  verificationStatus: CompanyVerificationStatus;
  logoUrl: string | null;
  tags: string[];
  operatingArea: CompanyOperatingArea;
  specializations: CompanySpecialization[];
  mainPoint: [number, number];
  mapPoints?: Array<{
    id: string;
    coordinates: [number, number];
    label?: string;
    isMain: boolean;
  }>;
  locationCount: number;
};
