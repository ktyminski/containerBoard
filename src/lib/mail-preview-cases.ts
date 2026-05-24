import {
  buildConciergeStockUploadMail,
  buildConciergeStockUploadConfirmationMail,
  buildContainerInquiryMail,
  type MailTemplateContent,
  buildEmailVerificationMail,
  buildListingExpiryReminderMail,
  buildPasswordResetMail,
  buildWelcomeMail,
} from "@/lib/mail-templates";
import type { AppMessages } from "@/lib/i18n";

export type MailPreviewCase = {
  id: string;
  label: string;
  description: string;
  mockedRecipient: string;
  content: MailTemplateContent;
};

export function getMailPreviewCases(messages: AppMessages["adminMailPreviews"]["cases"]): MailPreviewCase[] {
  const verificationUrl = "https://containerboard.eu/api/auth/verify-email?token=preview-token-123";
  const resetUrl = "https://containerboard.eu/reset-password?token=reset-preview-token-123";

  return [
    {
      id: "welcome",
      label: messages.welcome.label,
      description: messages.welcome.description,
      mockedRecipient: "jan.kowalski@example.com",
      content: buildWelcomeMail("Jan Kowalski"),
    },
    {
      id: "email-verification",
      label: messages.emailVerification.label,
      description: messages.emailVerification.description,
      mockedRecipient: "anna.nowak@example.com",
      content: buildEmailVerificationMail({
        name: "Anna Nowak",
        verificationUrl,
      }),
    },
    {
      id: "password-reset",
      label: messages.passwordReset.label,
      description: messages.passwordReset.description,
      mockedRecipient: "marta.wisniewska@example.com",
      content: buildPasswordResetMail({
        name: "Marta Wisniewska",
        resetUrl,
      }),
    },
    {
      id: "container-inquiry",
      label: messages.containerInquiry.label,
      description: messages.containerInquiry.description,
      mockedRecipient: "sprzedaz@example.com",
      content: buildContainerInquiryMail({
        containerLabel: "40' HC",
        summaryLine: "40' HC | sell | Gdansk, Poland",
        companyName: "Baltic Containers",
        listingQuantity: 8,
        listingUrl: "https://containerboard.eu/containers/67f1b4d6f1b7f3d0fcb12a34",
        buyerName: "Jan Kowalski",
        buyerEmail: "jan.kowalski@example.com",
        buyerPhone: "+48 600 700 800",
        inquiryMessage: "Prosze o kontakt i warunki dostawy.",
        requestedQuantity: 3,
        offeredPrice: "12000 EUR",
      }),
    },
    {
      id: "concierge-stock-upload",
      label: messages.conciergeStockUpload.label,
      description: messages.conciergeStockUpload.description,
      mockedRecipient: "concierge@containerboard.eu",
      content: buildConciergeStockUploadMail({
        companyName: "Baltic Containers",
        companySlug: "baltic-containers",
        userName: "Jan Kowalski",
        userEmail: "jan.kowalski@example.com",
        contactEmail: "sprzedaz@balticcontainers.eu",
        contactPhone: "+48 600 700 800",
        fileName: "stock-marzec-2026.xlsx",
        fileSizeBytes: 482731,
        fileContentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileDownloadUrl: "https://containerboard.eu/api/admin/concierge-requests/preview/file",
        note: "W pliku sa tylko stany dostepne od reki.\nPotrzebujemy publikacji jeszcze dzis.",
        requestedAtIso: "2026-03-18T09:42:00.000Z",
      }),
    },
    {
      id: "concierge-stock-upload-confirmation",
      label: messages.conciergeStockUploadConfirmation.label,
      description: messages.conciergeStockUploadConfirmation.description,
      mockedRecipient: "jan.kowalski@example.com",
      content: buildConciergeStockUploadConfirmationMail({
        name: "Jan Kowalski",
        companyName: "Baltic Containers",
        fileName: "stock-marzec-2026.xlsx",
      }),
    },
    {
      id: "listing-expiry-reminder-7d",
      label: messages.listingExpiryReminder7d.label,
      description: messages.listingExpiryReminder7d.description,
      mockedRecipient: "anna.nowak@example.com",
      content: buildListingExpiryReminderMail({
        name: "Anna Nowak",
        companyName: "Baltic Containers",
        quantity: 14,
        expiresAtIso: "2026-04-02T10:00:00.000Z",
        reminderDays: 7,
        manageUrl: "https://containerboard.eu/containers/mine",
        editUrl: "https://containerboard.eu/containers/67f1b4d6f1b7f3d0fcb12a34/edit",
        renewUrl: "https://containerboard.eu/containers/renew?token=preview-renew-token-7d",
      }),
    },
    {
      id: "listing-expiry-reminder-2d",
      label: messages.listingExpiryReminder2d.label,
      description: messages.listingExpiryReminder2d.description,
      mockedRecipient: "anna.nowak@example.com",
      content: buildListingExpiryReminderMail({
        name: "Anna Nowak",
        companyName: "Baltic Containers",
        quantity: 4,
        expiresAtIso: "2026-03-28T10:00:00.000Z",
        reminderDays: 2,
        manageUrl: "https://containerboard.eu/containers/mine",
        editUrl: "https://containerboard.eu/containers/67f1b4d6f1b7f3d0fcb12a35/edit",
        renewUrl: "https://containerboard.eu/containers/renew?token=preview-renew-token-2d",
      }),
    },
  ];
}
