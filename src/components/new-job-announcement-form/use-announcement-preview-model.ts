import { useMemo } from "react";
import { sanitizeJobDescriptionHtml } from "@/components/job-description-editor";
import { stripHtmlToPlainText } from "@/lib/rich-text";
import type { AppMessages } from "@/lib/i18n";
import {
  JOB_WORK_LOCATION_MODE,
  type JobEmploymentType,
  type JobRatePeriod,
  type JobWorkLocationMode,
  type JobWorkModel,
  type JobContractType,
} from "@/lib/job-announcement";
import type {
  JobAnnouncementCompany,
} from "@/components/new-job-announcement-form/types";
import {
  formatSalaryPreview,
  getLocationPreviewText,
} from "@/components/new-job-announcement-form/utils";

function extractCityFromAddressText(addressText: string): string | null {
  const segments = addressText
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const postalSegment = segments.find((segment) => /\d{2}-\d{3}\s+/.test(segment));
  if (postalSegment) {
    const withoutPostalCode = postalSegment.replace(/\d{2}-\d{3}\s+/, "").trim();
    if (withoutPostalCode) {
      return withoutPostalCode;
    }
  }

  if (segments.length >= 2) {
    return segments[1];
  }

  return segments[0];
}

type UseAnnouncementPreviewModelParams = {
  companies: JobAnnouncementCompany[];
  companyId: string;
  branchId: string;
  workLocationMode: JobWorkLocationMode;
  manualLocationText: string;
  mapLat: number | null;
  mapLng: number | null;
  workModel: JobWorkModel;
  employmentType: JobEmploymentType;
  contractTypes: JobContractType[];
  salaryRatePeriod: JobRatePeriod;
  salaryFrom: string;
  salaryTo: string;
  title: string;
  description: string;
  messages: AppMessages["announcementCreate"];
};

export function useAnnouncementPreviewModel(params: UseAnnouncementPreviewModelParams) {
  const selectedCompany = useMemo(
    () => params.companies.find((company) => company.id === params.companyId) ?? params.companies[0] ?? null,
    [params.companies, params.companyId],
  );

  const selectedBranch = useMemo(() => {
    if (!selectedCompany) {
      return null;
    }

    return selectedCompany.branches.find((branch) => branch.id === params.branchId) ?? null;
  }, [params.branchId, selectedCompany]);

  const selectedRecipientEmail = useMemo(() => {
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH) {
      return (selectedBranch?.email || selectedCompany?.email || "").trim();
    }

    return (selectedCompany?.email || "").trim();
  }, [params.workLocationMode, selectedBranch, selectedCompany]);

  const previewDescription = useMemo(
    () => sanitizeJobDescriptionHtml(params.description),
    [params.description],
  );

  const previewLocation = useMemo(
    () =>
      getLocationPreviewText({
        mode: params.workLocationMode,
        selectedBranch,
        manualLocationText: params.manualLocationText,
        mapLat: params.mapLat,
        mapLng: params.mapLng,
        messages: params.messages,
      }),
    [
      params.manualLocationText,
      params.mapLat,
      params.mapLng,
      params.messages,
      params.workLocationMode,
      selectedBranch,
    ],
  );

  const previewLocationCity = useMemo(() => {
    if (!previewLocation || previewLocation === params.messages.locationPreviewNoBranch) {
      return null;
    }

    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH) {
      const cityFromAddressParts = selectedBranch?.addressParts?.city?.trim();
      if (cityFromAddressParts) {
        return cityFromAddressParts;
      }

      return extractCityFromAddressText(selectedBranch?.addressText ?? "");
    }

    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) {
      const city = params.manualLocationText.split(",")[0]?.trim();
      return city || null;
    }

    return null;
  }, [
    params.manualLocationText,
    params.messages.locationPreviewNoBranch,
    params.workLocationMode,
    previewLocation,
    selectedBranch?.addressParts?.city,
    selectedBranch?.addressText,
  ]);

  const mapPickerLat = useMemo(() => {
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH) {
      return selectedBranch?.lat ?? null;
    }
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.ANYWHERE) {
      return null;
    }
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) {
      return params.mapLat;
    }
    return params.mapLat ?? selectedBranch?.lat ?? null;
  }, [params.mapLat, params.workLocationMode, selectedBranch]);

  const mapPickerLng = useMemo(() => {
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH) {
      return selectedBranch?.lng ?? null;
    }
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.ANYWHERE) {
      return null;
    }
    if (params.workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL) {
      return params.mapLng;
    }
    return params.mapLng ?? selectedBranch?.lng ?? null;
  }, [params.mapLng, params.workLocationMode, selectedBranch]);

  const salaryPreviewText = useMemo(
    () =>
      formatSalaryPreview({
        salaryFrom: params.salaryFrom,
        salaryTo: params.salaryTo,
        salaryRatePeriod: params.salaryRatePeriod,
        messages: params.messages,
      }),
    [
      params.messages,
      params.salaryFrom,
      params.salaryRatePeriod,
      params.salaryTo,
    ],
  );

  const plainDescription = useMemo(
    () => stripHtmlToPlainText(previewDescription),
    [previewDescription],
  );

  return {
    selectedCompany,
    selectedBranch,
    selectedRecipientEmail,
    previewDescription,
    plainDescription,
    previewLocation,
    previewLocationCity,
    mapPickerLat,
    mapPickerLng,
    salaryPreviewText,
    title: params.title,
    workModel: params.workModel,
    employmentType: params.employmentType,
    contractTypes: params.contractTypes,
  };
}
