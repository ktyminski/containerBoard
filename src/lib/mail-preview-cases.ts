import {
  buildContainerInquiryMail,
  type MailTemplateContent,
  buildClaimDecisionMail,
  buildClaimSubmittedMail,
  buildEmailVerificationMail,
  buildPasswordResetMail,
  buildWelcomeMail,
} from "@/lib/mail-templates";

export type MailPreviewCase = {
  id: string;
  label: string;
  description: string;
  mockedRecipient: string;
  content: MailTemplateContent;
};

export function getMailPreviewCases(): MailPreviewCase[] {
  const verificationUrl = "https://containerboard.pl/api/auth/verify-email?token=preview-token-123";
  const resetUrl = "https://containerboard.pl/reset-password?token=reset-preview-token-123";

  return [
    {
      id: "welcome",
      label: "Welcome",
      description: "Nowe konto zalozone przez Google SSO",
      mockedRecipient: "jan.kowalski@example.com",
      content: buildWelcomeMail("Jan Kowalski"),
    },
    {
      id: "email-verification",
      label: "Email verification",
      description: "Nowa rejestracja konta lokalnego",
      mockedRecipient: "anna.nowak@example.com",
      content: buildEmailVerificationMail({
        name: "Anna Nowak",
        verificationUrl,
      }),
    },
    {
      id: "password-reset",
      label: "Password reset",
      description: "Uzytkownik zglosil reset hasla",
      mockedRecipient: "marta.wisniewska@example.com",
      content: buildPasswordResetMail({
        name: "Marta Wisniewska",
        resetUrl,
      }),
    },
    {
      id: "claim-submitted",
      label: "Claim submitted",
      description: "Uzytkownik wyslal zgloszenie przejecia firmy",
      mockedRecipient: "pawel.maj@example.com",
      content: buildClaimSubmittedMail("Mazovia Express Sp. z o.o.", "Pawel Maj"),
    },
    {
      id: "claim-approved",
      label: "Claim approved",
      description: "Admin zaakceptowal zgloszenie przejecia firmy",
      mockedRecipient: "pawel.maj@example.com",
      content: buildClaimDecisionMail({
        approved: true,
        companyName: "Mazovia Express Sp. z o.o.",
        name: "Pawel Maj",
      }),
    },
    {
      id: "claim-rejected",
      label: "Claim rejected",
      description: "Admin odrzucil zgloszenie przejecia firmy",
      mockedRecipient: "kamil.nowicki@example.com",
      content: buildClaimDecisionMail({
        approved: false,
        companyName: "Baltic Freight Hub",
        name: "Kamil Nowicki",
      }),
    },
    {
      id: "container-inquiry",
      label: "Container inquiry",
      description: "Zapytanie do ogloszenia kontenerowego (z opcjonalna cena)",
      mockedRecipient: "sprzedaz@example.com",
      content: buildContainerInquiryMail({
        containerLabel: "40' HC",
        summaryLine: "40' HC | sell | Gdansk, Polska",
        companyName: "Baltic Containers",
        listingQuantity: 8,
        buyerName: "Jan Kowalski",
        buyerEmail: "jan.kowalski@example.com",
        buyerPhone: "+48 600 700 800",
        inquiryMessage: "Prosze o kontakt i warunki dostawy.",
        requestedQuantity: 3,
        offeredPrice: "12000 EUR",
      }),
    },
  ];
}
