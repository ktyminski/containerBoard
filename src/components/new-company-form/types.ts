import type { CompanyOperatingArea } from "@/lib/company-operating-area";
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
  lat: string;
  lng: string;
  useCustomDetails: boolean;
  phone: string;
  email: string;
};

export type NewCompanyFormValues = {
  name: string;
  description: string;
  operatingArea: CompanyOperatingArea;
  operatingAreaDetails: string;
  nip: string;
  phone: string;
  email: string;
  website: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  branches: BranchFormValue[];
};

export type ImageCropState = {
  sourceUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};
