import {
  buildShortAddressLabelFromParts,
  type GeocodeAddressParts,
} from "@/lib/geocode-address";
import { formatTemplate, type AppMessages } from "@/lib/i18n";
import {
  JOB_RATE_PERIOD,
  JOB_WORK_LOCATION_MODE,
  type JobRatePeriod,
  type JobWorkLocationMode,
} from "@/lib/job-announcement";
import type {
  JobAnnouncementCompany,
  JobAnnouncementFormValues,
} from "@/components/new-job-announcement-form/types";

const CONTACT_PERSON_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidContactPerson(input: {
  name: string;
  email: string;
  phone: string;
}): boolean {
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (name.length < 2 || name.length > 120) {
    return false;
  }
  if (!email && !phone) {
    return false;
  }
  if (email && (email.length > 220 || !CONTACT_PERSON_EMAIL_REGEX.test(email))) {
    return false;
  }
  if (phone && phone.length > 60) {
    return false;
  }

  return true;
}

export function formatButtonClass(isActive: boolean): string {
  return `rounded-md border px-2 py-1 text-xs transition ${
    isActive
      ? "border-sky-500 bg-sky-500/15 text-sky-200"
      : "border-slate-700 text-slate-300 hover:border-slate-500"
  }`;
}

export function getLocationPreviewText(input: {
  mode: JobWorkLocationMode;
  selectedBranch:
    | {
        label: string;
        addressText: string;
        addressParts?: GeocodeAddressParts | null;
      }
    | null
    | undefined;
  manualLocationText: string;
  mapLat: number | null;
  mapLng: number | null;
  messages: AppMessages["announcementCreate"];
}): string {
  if (input.mode === JOB_WORK_LOCATION_MODE.ANYWHERE) {
    return input.messages.locationPreviewAnywhere;
  }

  if (input.mode === JOB_WORK_LOCATION_MODE.MANUAL) {
    return input.manualLocationText.trim() || input.messages.locationPreviewManual;
  }

  if (input.mode === JOB_WORK_LOCATION_MODE.MAP) {
    return input.mapLat !== null && input.mapLng !== null
      ? formatTemplate(input.messages.locationPreviewMapPoint, {
          lat: input.mapLat.toFixed(4),
          lng: input.mapLng.toFixed(4),
        })
      : input.messages.locationPreviewMapUnset;
  }

  if (input.selectedBranch) {
    const shortAddress =
      buildShortAddressLabelFromParts({
        parts: input.selectedBranch.addressParts,
        fallbackLabel: input.selectedBranch.addressText,
      }) || input.selectedBranch.addressText;
    return `${input.selectedBranch.label} - ${shortAddress}`;
  }

  return input.messages.locationPreviewNoBranch;
}

export function formatSalaryPreview(input: {
  salaryFrom: string;
  salaryTo: string;
  salaryRatePeriod: JobRatePeriod;
  messages: AppMessages["announcementCreate"];
}): string | null {
  const parseSalaryPart = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value;
  };

  const fromValue = parseSalaryPart(input.salaryFrom);
  const toValue = parseSalaryPart(input.salaryTo);
  if (fromValue === null && toValue === null) {
    return null;
  }

  const suffix =
    input.salaryRatePeriod === JOB_RATE_PERIOD.MONTHLY
      ? input.messages.salarySuffixMonthly
      : input.messages.salarySuffixHourly;
  if (fromValue !== null && toValue !== null) {
    return formatTemplate(input.messages.salaryRangeTemplate, {
      from: String(fromValue),
      to: String(toValue),
      suffix,
    });
  }
  if (fromValue !== null) {
    return formatTemplate(input.messages.salaryFromTemplate, {
      value: String(fromValue),
      suffix,
    });
  }
  return formatTemplate(input.messages.salaryToTemplate, {
    value: String(toValue),
    suffix,
  });
}

export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function getBranchAddressLabel(
  branch: JobAnnouncementCompany["branches"][number] | null | undefined,
): string {
  if (!branch) {
    return "-";
  }

  return (
    buildShortAddressLabelFromParts({
      parts: branch.addressParts,
      fallbackLabel: branch.addressText,
    }) || branch.addressText
  );
}

export function validatePublishFields(input: {
  values: JobAnnouncementFormValues;
  selectedCompany: JobAnnouncementCompany | null;
  selectedBranch: JobAnnouncementCompany["branches"][number] | null;
  selectedRecipientEmail: string;
  messages: AppMessages["announcementCreate"];
}): {
  fieldErrors: Partial<Record<keyof JobAnnouncementFormValues, string>>;
  contactPersonError: string | null;
} {
  const values = input.values;
  const fieldErrors: Partial<Record<keyof JobAnnouncementFormValues, string>> = {};
  let contactPersonError: string | null = null;

  if (!input.selectedCompany) {
    fieldErrors.companyId = input.messages.companyRequiredText;
  }

  if (
    values.workLocationMode === JOB_WORK_LOCATION_MODE.BRANCH &&
    !input.selectedBranch
  ) {
    fieldErrors.branchId = input.messages.requiredField;
  }

  if (
    values.workLocationMode === JOB_WORK_LOCATION_MODE.MANUAL &&
    values.manualLocationText.trim().length < 3
  ) {
    fieldErrors.manualLocationText = input.messages.requiredField;
  }

  if (values.workLocationMode === JOB_WORK_LOCATION_MODE.MAP) {
    if (values.mapLat === null || values.mapLng === null) {
      fieldErrors.mapLat = input.messages.requiredField;
    }
  }

  if (values.title.trim().length < 3) {
    fieldErrors.title = input.messages.titleLengthError;
  }

  const plainDescription = values.description ? values.description.trim() : "";
  if (plainDescription.length < 20) {
    fieldErrors.description = input.messages.descriptionLengthError;
  }

  if (values.contractTypes.length === 0) {
    fieldErrors.contractTypes = input.messages.contractRequired;
  }

  const parsedSalaryFrom = parseOptionalNumber(values.salaryFrom);
  const parsedSalaryTo = parseOptionalNumber(values.salaryTo);

  if (
    parsedSalaryFrom !== null &&
    parsedSalaryTo !== null &&
    parsedSalaryFrom > parsedSalaryTo
  ) {
    fieldErrors.salaryTo = input.messages.salaryRangeInvalid;
  }

  if (!values.useCompanyOrBranchEmail) {
    const mail = values.applicationEmail.trim();
    if (!mail) {
      fieldErrors.applicationEmail = input.messages.requiredField;
    } else if (!CONTACT_PERSON_EMAIL_REGEX.test(mail)) {
      fieldErrors.applicationEmail = input.messages.applicationEmailInvalid;
    }
  } else if (!input.selectedRecipientEmail) {
    fieldErrors.applicationEmail = input.messages.applicationEmailMissingCompany;
  }

  if (values.contactPersons.some((person) => !isValidContactPerson(person))) {
    contactPersonError = input.messages.validationError;
  }

  return {
    fieldErrors,
    contactPersonError,
  };
}
