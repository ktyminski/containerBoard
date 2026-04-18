export type MailTemplateContent = {
  subject: string;
  text: string;
  html: string;
};

const BRAND_NAME = "ContainerBoard";
const BRAND_WEBSITE_URL = "https://containerboard.pl";
const BRAND_SUPPORT_EMAIL = "support@containerboard.pl";

const MAIL_COLORS = {
  pageBackground: "#edf2f7",
  cardBackground: "#ffffff",
  cardBorder: "#d2dce8",
  headerBackground: "#0f3e67",
  headerAccent: "#26a0da",
  heading: "#0f2a43",
  text: "#263645",
  muted: "#6a7b8c",
  link: "#0b67b2",
  panelBackground: "#f4f8fc",
  panelBorder: "#d7e3f0",
  buttonBackground: "#0b67b2",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function greeting(name?: string): string {
  return name?.trim() ? `Cześć ${name.trim()},` : "Cześć,";
}

function htmlParagraph(text: string): string {
  return `<p style="Margin:0 0 14px 0;">${escapeHtml(text)}</p>`;
}

function htmlParagraphRaw(html: string): string {
  return `<p style="Margin:0 0 14px 0;">${html}</p>`;
}

function htmlButton(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="Margin:0 0 16px 0;"><tr><td bgcolor="${MAIL_COLORS.buttonBackground}" style="background-color:${MAIL_COLORS.buttonBackground};border-radius:6px;"><a href="${safeUrl}" style="display:inline-block;padding:11px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:18px;color:#ffffff;text-decoration:none;">${safeLabel}</a></td></tr></table>`;
}

function renderTextLayout(input: {
  intro?: string;
  sections: string[];
}): string {
  const chunks: string[] = [];
  if (input.intro?.trim()) {
    chunks.push(input.intro.trim());
  }
  chunks.push(...input.sections.filter((section) => section.trim().length > 0));
  chunks.push(
    "Pozdrawiamy,\nZespół ContainerBoard",
    "---\nWiadomość wygenerowana automatycznie. W razie pytań możesz odpisać na ten email.",
  );
  return chunks.join("\n\n");
}

function renderHtmlLayout(input: {
  preheader: string;
  title: string;
  intro?: string;
  contentHtml: string;
}): string {
  const safePreheader = escapeHtml(input.preheader);
  const safeTitle = escapeHtml(input.title);
  const introHtml = input.intro ? htmlParagraph(input.intro) : "";

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="Margin:0;padding:0;background-color:${MAIL_COLORS.pageBackground};">
    <span style="display:none !important;visibility:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
      ${safePreheader}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${MAIL_COLORS.pageBackground}" style="background-color:${MAIL_COLORS.pageBackground};">
      <tr>
        <td align="center" style="padding:22px 10px;">
          <!--[if mso]>
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
          <![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${MAIL_COLORS.cardBackground};border:1px solid ${MAIL_COLORS.cardBorder};">
            <tr>
              <td bgcolor="${MAIL_COLORS.headerBackground}" style="background-color:${MAIL_COLORS.headerBackground};border-top:5px solid ${MAIL_COLORS.headerAccent};padding:16px 22px;font-family:Arial,Helvetica,sans-serif;">
                <div style="font-size:21px;line-height:24px;color:#ffffff;font-weight:700;">${BRAND_NAME}</div>
                <div style="Margin-top:6px;font-size:13px;line-height:18px;color:#d6e7f5;">Platforma transportu i logistyki</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 22px 18px 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${MAIL_COLORS.text};">
                <h1 style="Margin:0 0 16px 0;font-size:22px;line-height:29px;color:${MAIL_COLORS.heading};font-weight:700;">${safeTitle}</h1>
                ${introHtml}
                ${input.contentHtml}
              </td>
            </tr>
            <tr>
              <td bgcolor="#f7fafd" style="background-color:#f7fafd;border-top:1px solid ${MAIL_COLORS.cardBorder};padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${MAIL_COLORS.muted};">
                <div>Wiadomość wygenerowana automatycznie przez ${BRAND_NAME}.</div>
                <div style="Margin-top:4px;">
                  <a href="${BRAND_WEBSITE_URL}" style="color:${MAIL_COLORS.link};text-decoration:underline;">${BRAND_WEBSITE_URL}</a>
                  &nbsp;|&nbsp;
                  <a href="mailto:${BRAND_SUPPORT_EMAIL}" style="color:${MAIL_COLORS.link};text-decoration:underline;">${BRAND_SUPPORT_EMAIL}</a>
                </div>
              </td>
            </tr>
          </table>
          <!--[if mso]>
              </td>
            </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildWelcomeMail(name?: string): MailTemplateContent {
  const intro = greeting(name);
  const subject = "Witamy w ContainerBoard";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        "Dziękujemy za rejestrację konta w ContainerBoard.",
        "Możesz już korzystac z aplikacji.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Konto zostało aktywowane. Możesz już korzystac z ContainerBoard.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraph("Dziękujemy za rejestrację konta w ContainerBoard.") +
        htmlParagraph("Możesz już korzystac z aplikacji."),
    }),
  };
}

export function buildEmailVerificationMail(input: {
  name?: string;
  verificationUrl: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const safeVerificationUrl = escapeHtml(input.verificationUrl);
  const subject = "Potwierdź adres email w ContainerBoard";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        "Aby aktywować konto, potwierdź swój adres email klikając link:",
        input.verificationUrl,
        "Link jest ważny przez 24 godziny.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Potwierdz email i aktywuj konto ContainerBoard.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraph("Aby aktywować konto, potwierdź swój adres email klikając przycisk:") +
        htmlButton(input.verificationUrl, "Potwierdź adres email") +
        htmlParagraphRaw(
          `Lub skopiuj link do przeglądarki:<br/><a href="${safeVerificationUrl}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${safeVerificationUrl}</a>`,
        ) +
        htmlParagraph("Link jest ważny przez 24 godziny."),
    }),
  };
}

export function buildPasswordResetMail(input: {
  name?: string;
  resetUrl: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const safeResetUrl = escapeHtml(input.resetUrl);
  const subject = "Reset hasła w ContainerBoard";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        "Otrzymaliśmy prośbę o ustawienie nowego hasła do Twojego konta ContainerBoard.",
        "Aby ustawić nowe hasło, kliknij link:",
        input.resetUrl,
        "Link jest ważny przez 1 godzinę. Jeżeli to nie Ty, zignoruj tę wiadomość.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Reset hasła do konta ContainerBoard.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraph(
          "Otrzymaliśmy prośbę o ustawienie nowego hasła do Twojego konta ContainerBoard.",
        ) +
        htmlButton(input.resetUrl, "Ustaw nowe hasło") +
        htmlParagraphRaw(
          `Lub skopiuj link do przeglądarki:<br/><a href="${safeResetUrl}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${safeResetUrl}</a>`,
        ) +
        htmlParagraph(
          "Link jest ważny przez 1 godzinę. Jeżeli to nie Ty, zignoruj tę wiadomość.",
        ),
    }),
  };
}

export function buildClaimSubmittedMail(
  companyName: string,
  name?: string,
): MailTemplateContent {
  const intro = greeting(name);
  const subject = "Zgłoszenie przejęcia zostało przyjęte";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        `Twoje zgłoszenie przejęcia firmy "${companyName}" zostało zapisane i czeka na decyzję administratora.`,
        "Powiadomimy Cię mailowo, gdy decyzja zostanie podjęta.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Twoje zgłoszenie przejęcia firmy zostało przyjete.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraphRaw(
          `Twoje zgłoszenie przejęcia firmy "<strong>${escapeHtml(companyName)}</strong>" zostało zapisane i czeka na decyzję administratora.`,
        ) + htmlParagraph("Powiadomimy Cię mailowo, gdy decyzja zostanie podjęta."),
    }),
  };
}

export function buildClaimDecisionMail(input: {
  approved: boolean;
  companyName: string;
  name?: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const decision = input.approved ? "zaakceptowane" : "odrzucone";
  const subject = input.approved
    ? "Decyzja: zgłoszenie przejęcia zaakceptowane"
    : "Decyzja: zgłoszenie przejęcia odrzucone";
  const outcomeText = input.approved
    ? "Możesz teraz zarządzać profilem tej firmy jako właściciel."
    : "W razie potrzeby możesz skontaktować się z administratorem.";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        `Twoje zgłoszenie przejęcia firmy "${input.companyName}" zostało ${decision}.`,
        outcomeText,
      ],
    }),
    html: renderHtmlLayout({
      preheader: input.approved
        ? "Zgłoszenie przejęcia firmy zostało zaakceptowane."
        : "Zgłoszenie przejęcia firmy zostało odrzucone.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraphRaw(
          `Twoje zgłoszenie przejęcia firmy "<strong>${escapeHtml(input.companyName)}</strong>" zostało <strong>${escapeHtml(decision)}</strong>.`,
        ) + htmlParagraph(outcomeText),
    }),
  };
}

export function buildOfferPublishedMail(input: {
  name?: string;
  offerTitle: string;
  companyName: string;
  offerUrl?: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const subject = `Potwierdzenie publikacji oferty: ${input.offerTitle}`;

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        `Twoja oferta "${input.offerTitle}" dla firmy "${input.companyName}" została opublikowana.`,
        ...(input.offerUrl ? [`Link do oferty: ${input.offerUrl}`] : []),
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Twoja oferta została opublikowana.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraphRaw(
          `Twoja oferta "<strong>${escapeHtml(input.offerTitle)}</strong>" dla firmy "<strong>${escapeHtml(input.companyName)}</strong>" została opublikowana.`,
        ) + (input.offerUrl ? htmlButton(input.offerUrl, "Przejdź do oferty") : ""),
    }),
  };
}

export function buildContainerInquiryMail(input: {
  containerLabel: string;
  summaryLine: string;
  companyName: string;
  listingQuantity: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  inquiryMessage?: string;
  requestedQuantity?: number;
  offeredPrice?: string;
}): MailTemplateContent {
  const subject = `Nowe zapytanie o kontener - ${input.containerLabel}`;
  const sections = [
    `Kontener: ${input.summaryLine}`,
    `Firma/ogloszenie: ${input.companyName}`,
    `Ilosc w ogloszeniu: ${input.listingQuantity}`,
    "Dane osoby pytajacej:",
    `Imie i nazwisko: ${input.buyerName}`,
    `Email: ${input.buyerEmail}`,
    input.buyerPhone ? `Telefon: ${input.buyerPhone}` : "",
    input.inquiryMessage ? `Wiadomosc: ${input.inquiryMessage}` : "",
    input.requestedQuantity ? `Oczekiwana ilosc: ${input.requestedQuantity}` : "",
    input.offeredPrice ? `Proponowana cena: ${input.offeredPrice}` : "",
  ].filter((line) => line.trim().length > 0);

  const htmlLines = [
    `<strong>Kontener:</strong> ${escapeHtml(input.summaryLine)}<br/>`,
    `<strong>Firma/ogloszenie:</strong> ${escapeHtml(input.companyName)}<br/>`,
    `<strong>Ilosc w ogloszeniu:</strong> ${input.listingQuantity}`,
    "<br/><br/><strong>Dane osoby pytajacej:</strong><br/>",
    `<strong>Imie i nazwisko:</strong> ${escapeHtml(input.buyerName)}<br/>`,
    `<strong>Email:</strong> ${escapeHtml(input.buyerEmail)}<br/>`,
    input.buyerPhone ? `<strong>Telefon:</strong> ${escapeHtml(input.buyerPhone)}<br/>` : "",
    input.inquiryMessage
      ? `<strong>Wiadomosc:</strong><br/>${escapeHtml(input.inquiryMessage).replaceAll("\n", "<br/>")}<br/>`
      : "",
    input.requestedQuantity
      ? `<strong>Oczekiwana ilosc:</strong> ${input.requestedQuantity}<br/>`
      : "",
    input.offeredPrice
      ? `<strong>Proponowana cena:</strong> ${escapeHtml(input.offeredPrice)}`
      : "",
  ]
    .filter((line) => line.trim().length > 0)
    .join("");

  return {
    subject,
    text: renderTextLayout({
      sections,
    }),
    html: renderHtmlLayout({
      preheader: "Nowe zapytanie o kontener",
      title: subject,
      contentHtml: htmlParagraphRaw(htmlLines),
    }),
  };
}

export function buildConciergeStockUploadMail(input: {
  companyName: string;
  companySlug?: string;
  userName: string;
  userEmail: string;
  contactEmail?: string;
  contactPhone?: string;
  fileName: string;
  fileSizeBytes: number;
  fileContentType: string;
  fileUrl: string;
  note?: string;
  requestedAtIso: string;
}): MailTemplateContent {
  const subject = `Nowe zgloszenie Concierge - ${input.companyName}`;

  const textSections = [
    "Nowe zgloszenie concierge bulk import.",
    `Firma: ${input.companyName}`,
    input.companySlug ? `Slug firmy: ${input.companySlug}` : "",
    `Uzytkownik: ${input.userName} (${input.userEmail})`,
    input.contactEmail ? `Email kontaktowy: ${input.contactEmail}` : "",
    input.contactPhone ? `Telefon kontaktowy: ${input.contactPhone}` : "",
    `Plik: ${input.fileName}`,
    `Typ pliku: ${input.fileContentType}`,
    `Rozmiar: ${input.fileSizeBytes} B`,
    `URL pliku: ${input.fileUrl}`,
    `Data zgloszenia: ${input.requestedAtIso}`,
    input.note ? `Notatka: ${input.note}` : "",
  ].filter((line) => line.trim().length > 0);

  const htmlLines = [
    "<strong>Nowe zgloszenie concierge bulk import</strong><br/>",
    `<strong>Firma:</strong> ${escapeHtml(input.companyName)}<br/>`,
    input.companySlug
      ? `<strong>Slug firmy:</strong> ${escapeHtml(input.companySlug)}<br/>`
      : "",
    `<strong>Uzytkownik:</strong> ${escapeHtml(input.userName)} (${escapeHtml(input.userEmail)})<br/>`,
    input.contactEmail
      ? `<strong>Email kontaktowy:</strong> ${escapeHtml(input.contactEmail)}<br/>`
      : "",
    input.contactPhone
      ? `<strong>Telefon kontaktowy:</strong> ${escapeHtml(input.contactPhone)}<br/>`
      : "",
    `<strong>Plik:</strong> ${escapeHtml(input.fileName)}<br/>`,
    `<strong>Typ pliku:</strong> ${escapeHtml(input.fileContentType)}<br/>`,
    `<strong>Rozmiar:</strong> ${input.fileSizeBytes} B<br/>`,
    `<strong>Data zgloszenia:</strong> ${escapeHtml(input.requestedAtIso)}<br/>`,
    `<strong>URL pliku:</strong> <a href="${escapeHtml(input.fileUrl)}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${escapeHtml(input.fileUrl)}</a><br/>`,
    input.note
      ? `<br/><strong>Notatka:</strong><br/>${escapeHtml(input.note).replaceAll("\n", "<br/>")}`
      : "",
  ]
    .filter((line) => line.trim().length > 0)
    .join("");

  return {
    subject,
    text: renderTextLayout({ sections: textSections }),
    html: renderHtmlLayout({
      preheader: "Nowe zgloszenie concierge upload",
      title: subject,
      contentHtml: htmlParagraphRaw(htmlLines),
    }),
  };
}

export function buildListingExpiryReminderMail(input: {
  name?: string;
  companyName: string;
  quantity: number;
  expiresAtIso: string;
  reminderDays: number;
  manageUrl: string;
  editUrl: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const expiresAt = new Date(input.expiresAtIso);
  const expiresAtLabel = Number.isFinite(expiresAt.getTime())
    ? expiresAt.toLocaleDateString("pl-PL")
    : input.expiresAtIso;
  const subject =
    input.reminderDays <= 2
      ? "Ostatnie przypomnienie: ogloszenie wygasa za 2 dni"
      : "Przypomnienie: ogloszenie wygasa za 7 dni";

  const textSections = [
    `Twoje ogloszenie (${input.companyName}) wygasa: ${expiresAtLabel}.`,
    `Aktualna ilosc kontenerow: ${input.quantity}.`,
    "Przed przedluzeniem sprawdz, czy ilosc i cena sa nadal aktualne.",
    `Przejdz do moich kontenerow: ${input.manageUrl}`,
    `Jesli cos sie zmienilo, edytuj ogloszenie: ${input.editUrl}`,
  ];

  const htmlSections =
    htmlParagraphRaw(
      `Twoje ogloszenie (<strong>${escapeHtml(input.companyName)}</strong>) wygasa: <strong>${escapeHtml(expiresAtLabel)}</strong>.`,
    ) +
    htmlParagraphRaw(
      `Aktualna ilosc kontenerow: <strong>${Math.max(1, Math.trunc(input.quantity))}</strong>.`,
    ) +
    htmlParagraph(
      "Przed przedluzeniem sprawdz, czy ilosc i cena sa nadal aktualne.",
    ) +
    htmlButton(input.manageUrl, "Przejdz do moich kontenerow") +
    htmlParagraphRaw(
      `Jesli cos sie zmienilo, przejdz do edycji ogloszenia:<br/><a href="${escapeHtml(input.editUrl)}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${escapeHtml(input.editUrl)}</a>`,
    );

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: textSections,
    }),
    html: renderHtmlLayout({
      preheader:
        input.reminderDays <= 2
          ? "Ostatnie przypomnienie o wygasaniu ogloszenia."
          : "Przypomnienie o wygasaniu ogloszenia.",
      title: subject,
      intro,
      contentHtml: htmlSections,
    }),
  };
}

