import { JobAnnouncementPreviewCard } from "@/components/job-announcement-form-parts";
import type { AppMessages } from "@/lib/i18n";
import type {
  JobAnnouncementCompany,
  JobAnnouncementFormValues,
} from "@/components/new-job-announcement-form/types";

type PreviewModalProps = {
  isOpen: boolean;
  messages: AppMessages["announcementCreate"];
  selectedCompany: JobAnnouncementCompany;
  selectedCompanyBenefitLabels: string[];
  companyBenefitsTitle: string;
  title: string;
  workModel: JobAnnouncementFormValues["workModel"];
  employmentType: JobAnnouncementFormValues["employmentType"];
  contractTypes: JobAnnouncementFormValues["contractTypes"];
  previewLocationCity: string | null;
  previewLocation: string;
  previewDescription: string;
  salaryPreviewText: string | null;
  tags: string[];
  selectedRequirementLabels: string[];
  externalLinks: string[];
  contactPersons: JobAnnouncementFormValues["contactPersons"];
  onClose: () => void;
};

export function JobAnnouncementPreviewModal({
  isOpen,
  messages,
  selectedCompany,
  selectedCompanyBenefitLabels,
  companyBenefitsTitle,
  title,
  workModel,
  employmentType,
  contractTypes,
  previewLocationCity,
  previewLocation,
  previewDescription,
  salaryPreviewText,
  tags,
  selectedRequirementLabels,
  externalLinks,
  contactPersons,
  onClose,
}: PreviewModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
              {messages.previewModalEyebrow}
            </p>
            <h3 className="text-sm font-semibold text-slate-100">
              {messages.previewModalTitle}
            </h3>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
            onClick={onClose}
          >
            {messages.requirementsModalClose}
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">
          <JobAnnouncementPreviewCard
            selectedCompany={selectedCompany}
            companyBenefits={selectedCompanyBenefitLabels}
            companyBenefitsTitle={companyBenefitsTitle}
            title={title}
            workModel={workModel}
            employmentType={employmentType}
            contractTypes={contractTypes}
            previewLocationCity={previewLocationCity}
            previewLocation={previewLocation}
            previewDescription={previewDescription}
            salaryText={salaryPreviewText}
            tags={tags}
            requirements={selectedRequirementLabels}
            externalLinks={externalLinks}
            contactPersons={contactPersons ?? []}
            messages={messages}
          />
        </div>
      </div>
    </div>
  );
}


