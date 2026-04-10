import {
  type MailTemplateContent,
  buildAnnouncementApplicationMail,
  buildAnnouncementPublishedMail,
  buildClaimDecisionMail,
  buildClaimSubmittedMail,
  buildEmailVerificationMail,
  buildLeadRequestPublishedMail,
  buildOfferPublishedMail,
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
  const announcementUrl = "https://containerboard.pl/announcements/67f9f1ea1e8f4f0012ab34cd";
  const offerUrl = "https://containerboard.pl/offers/67f9f1ea1e8f4f0012ab98ef";
  const leadBoardUrl = "https://containerboard.pl/list";

  return [
    {
      id: "welcome",
      label: "Welcome",
      description: "Nowe konto zaÅ‚oÅ¼one przez Google SSO",
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
      description: "UÅ¼ytkownik zgÅ‚osiÅ‚ reset hasÅ‚a",
      mockedRecipient: "marta.wisniewska@example.com",
      content: buildPasswordResetMail({
        name: "Marta Wisniewska",
        resetUrl,
      }),
    },
    {
      id: "claim-submitted",
      label: "Claim submitted",
      description: "UÅ¼ytkownik wysÅ‚aÅ‚ zgÅ‚oszenie przejÄ™cia firmy",
      mockedRecipient: "pawel.maj@example.com",
      content: buildClaimSubmittedMail("Mazovia Express Sp. z o.o.", "Pawel Maj"),
    },
    {
      id: "claim-approved",
      label: "Claim approved",
      description: "Admin zaakceptowaÅ‚ zgÅ‚oszenie przejÄ™cia firmy",
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
      description: "Admin odrzuciÅ‚ zgÅ‚oszenie przejÄ™cia firmy",
      mockedRecipient: "kamil.nowicki@example.com",
      content: buildClaimDecisionMail({
        approved: false,
        companyName: "Baltic Freight Hub",
        name: "Kamil Nowicki",
      }),
    },
    {
      id: "announcement-application",
      label: "Announcement application",
      description: "Kandydat wysÅ‚aÅ‚ aplikacjÄ™ na ogÅ‚oszenie",
      mockedRecipient: "rekrutacja@mazovia-express.example.com",
      content: buildAnnouncementApplicationMail({
        announcementTitle: "Spedytor miÄ™dzynarodowy",
        companyName: "Mazovia Express Sp. z o.o.",
        locationLabel: "Warszawa - ul. Logistyczna 15",
        applicantName: "Piotr Zielinski",
        applicantEmail: "piotr.zielinski@example.com",
        applicantPhone: "+48 600 700 800",
        applicantMessage:
          "DzieÅ„ dobry,\nprzesyÅ‚am aplikacjÄ™ na stanowisko. Mam 6 lat doÅ›wiadczenia w transporcie miÄ™dzynarodowym.",
        cvFilename: "Piotr_Zielinski_CV.pdf",
      }),
    },
    {
      id: "announcement-published",
      label: "Announcement published",
      description: "Potwierdzenie publikacji ogÅ‚oszenia pracy",
      mockedRecipient: "owner@mazovia-express.example.com",
      content: buildAnnouncementPublishedMail({
        name: "Anna Owner",
        announcementTitle: "Dyspozytor transportu krajowego",
        companyName: "Mazovia Express Sp. z o.o.",
        announcementUrl,
      }),
    },
    {
      id: "offer-published",
      label: "Offer published",
      description: "Potwierdzenie publikacji oferty firmy",
      mockedRecipient: "owner@baltic-freight-hub.example.com",
      content: buildOfferPublishedMail({
        name: "Tomasz Wrobel",
        offerTitle: "Magazyn cross-dock 24/7",
        companyName: "Baltic Freight Hub",
        offerUrl,
      }),
    },
    {
      id: "lead-request-published",
      label: "Lead request published",
      description: "Potwierdzenie publikacji zapytania ofertowego",
      mockedRecipient: "logistyka@northsea-fulfillment.example.com",
      content: buildLeadRequestPublishedMail({
        name: "Ewa Dabrowska",
        leadTypeLabel: "Transport",
        descriptionPreview: "Transport 24 palet EUR, Warszawa -> Hamburg, zaÅ‚adunek 2026-03-24.",
        boardUrl: leadBoardUrl,
      }),
    },
  ];
}






