import type { CompanyCommunicationLanguage } from "@/types/company-communication-language";
import type { CompanyBenefit } from "@/lib/company-benefits";
import type { CompanyOperatingArea } from "@/lib/company-operating-area";
import type { CompanySpecialization } from "@/types/company-specialization";
import type { GeocodeAddressParts } from "@/lib/geocode-address";

export type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export type BranchFormValue = {
  label: string;
  addressText: string;
  addressParts?: GeocodeAddressParts | null;
  note: string;
  lat: string;
  lng: string;
  useCustomDetails: boolean;
  phone: string;
  email: string;
  category: string;
};

export type NewCompanyFormValues = {
  name: string;
  description: string;
  communicationLanguages: CompanyCommunicationLanguage[];
  operatingArea: CompanyOperatingArea;
  operatingAreaDetails: string;
  nip: string;
  phone: string;
  email: string;
  website: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  benefits: CompanyBenefit[];
  specializations: CompanySpecialization[];
  branches: BranchFormValue[];
};

export type ImageCropState = {
  sourceUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};
