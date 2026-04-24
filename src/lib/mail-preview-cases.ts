import {
  buildContainerInquiryMail,
  type MailTemplateContent,
  buildClaimDecisionMail,
  buildClaimSubmittedMail,
  buildEmailVerificationMail,
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
  const verificationUrl = "https://containerboard.pl/api/auth/verify-email?token=preview-token-123";
  const resetUrl = "https://containerboard.pl/reset-password?token=reset-preview-token-123";

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
      id: "claim-submitted",
      label: messages.claimSubmitted.label,
      description: messages.claimSubmitted.description,
      mockedRecipient: "pawel.maj@example.com",
      content: buildClaimSubmittedMail("Mazovia Express Sp. z o.o.", "Pawel Maj"),
    },
    {
      id: "claim-approved",
      label: messages.claimApproved.label,
      description: messages.claimApproved.description,
      mockedRecipient: "pawel.maj@example.com",
      content: buildClaimDecisionMail({
        approved: true,
        companyName: "Mazovia Express Sp. z o.o.",
        name: "Pawel Maj",
      }),
    },
    {
      id: "claim-rejected",
      label: messages.claimRejected.label,
      description: messages.claimRejected.description,
      mockedRecipient: "kamil.nowicki@example.com",
      content: buildClaimDecisionMail({
        approved: false,
        companyName: "Baltic Freight Hub",
        name: "Kamil Nowicki",
      }),
    },
    {
      id: "container-inquiry",
      label: messages.containerInquiry.label,
      description: messages.containerInquiry.description,
      mockedRecipient: "sprzedaz@example.com",
      content: buildContainerInquiryMail({
        containerLabel: "40' HC",
        summaryLine: "40' HC | sell | Gdańsk, Polska",
        companyName: "Baltic Containers",
        listingQuantity: 8,
        buyerName: "Jan Kowalski",
        buyerEmail: "jan.kowalski@example.com",
        buyerPhone: "+48 600 700 800",
        inquiryMessage: "Proszę o kontakt i warunki dostawy.",
        requestedQuantity: 3,
        offeredPrice: "12000 EUR",
      }),
    },
  ];
}
