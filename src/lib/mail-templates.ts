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
  return name?.trim() ? `Hello ${name.trim()},` : "Hello,";
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
    `Best regards,\n${BRAND_NAME} team`,
    "---\nThis is an automated message. You can reply to this email if you need help.",
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
<html lang="en">
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
                <div style="Margin-top:6px;font-size:13px;line-height:18px;color:#d6e7f5;">Container marketplace</div>
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
                <div>This message was generated automatically by ${BRAND_NAME}.</div>
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
  const subject = "Welcome to ContainerBoard";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        "Thanks for creating your ContainerBoard account.",
        "You can now start using the platform.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Your account is ready to use.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraph("Thanks for creating your ContainerBoard account.") +
        htmlParagraph("You can now start using the platform."),
    }),
  };
}

export function buildEmailVerificationMail(input: {
  name?: string;
  verificationUrl: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const safeVerificationUrl = escapeHtml(input.verificationUrl);
  const subject = "Verify your email address";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        "To activate your account, please verify your email address using the link below:",
        input.verificationUrl,
        "This link is valid for 24 hours.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Verify your email to activate your account.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraph("To activate your account, please use the button below:") +
        htmlButton(input.verificationUrl, "Verify email") +
        htmlParagraphRaw(
          `Or copy this link into your browser:<br/><a href="${safeVerificationUrl}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${safeVerificationUrl}</a>`,
        ) +
        htmlParagraph("This link is valid for 24 hours."),
    }),
  };
}

export function buildPasswordResetMail(input: {
  name?: string;
  resetUrl: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const safeResetUrl = escapeHtml(input.resetUrl);
  const subject = "Reset your password";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        "We received a request to reset the password for your ContainerBoard account.",
        "Use the link below to set a new password:",
        input.resetUrl,
        "This link is valid for 1 hour. If this was not you, you can ignore this message.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Password reset request for your account.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraph("We received a request to reset the password for your ContainerBoard account.") +
        htmlButton(input.resetUrl, "Set a new password") +
        htmlParagraphRaw(
          `Or copy this link into your browser:<br/><a href="${safeResetUrl}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${safeResetUrl}</a>`,
        ) +
        htmlParagraph(
          "This link is valid for 1 hour. If this was not you, you can ignore this message.",
        ),
    }),
  };
}

export function buildClaimSubmittedMail(
  companyName: string,
  name?: string,
): MailTemplateContent {
  const intro = greeting(name);
  const subject = "Your company claim has been received";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        `Your claim for "${companyName}" has been recorded and is waiting for review.`,
        "We will notify you by email once a decision has been made.",
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Your company claim is now waiting for review.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraphRaw(
          `Your claim for "<strong>${escapeHtml(companyName)}</strong>" has been recorded and is waiting for review.`,
        ) + htmlParagraph("We will notify you by email once a decision has been made."),
    }),
  };
}

export function buildClaimDecisionMail(input: {
  approved: boolean;
  companyName: string;
  name?: string;
}): MailTemplateContent {
  const intro = greeting(input.name);
  const decisionLabel = input.approved ? "approved" : "rejected";
  const subject = input.approved
    ? "Your company claim has been approved"
    : "Your company claim has been rejected";
  const followUp = input.approved
    ? "You can now manage this company profile as its owner."
    : "If you need help, please contact support.";

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        `Your claim for "${input.companyName}" has been ${decisionLabel}.`,
        followUp,
      ],
    }),
    html: renderHtmlLayout({
      preheader: input.approved
        ? "Your company claim has been approved."
        : "Your company claim has been rejected.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraphRaw(
          `Your claim for "<strong>${escapeHtml(input.companyName)}</strong>" has been <strong>${decisionLabel}</strong>.`,
        ) + htmlParagraph(followUp),
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
  const subject = `Offer published: ${input.offerTitle}`;

  return {
    subject,
    text: renderTextLayout({
      intro,
      sections: [
        `Your offer "${input.offerTitle}" for "${input.companyName}" has been published.`,
        ...(input.offerUrl ? [`Offer link: ${input.offerUrl}`] : []),
      ],
    }),
    html: renderHtmlLayout({
      preheader: "Your offer is now live.",
      title: subject,
      intro,
      contentHtml:
        htmlParagraphRaw(
          `Your offer "<strong>${escapeHtml(input.offerTitle)}</strong>" for "<strong>${escapeHtml(input.companyName)}</strong>" has been published.`,
        ) + (input.offerUrl ? htmlButton(input.offerUrl, "Open offer") : ""),
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
  const subject = `New container inquiry - ${input.containerLabel}`;
  const sections = [
    `Container: ${input.summaryLine}`,
    `Company/listing: ${input.companyName}`,
    `Quantity in listing: ${input.listingQuantity}`,
    "Buyer details:",
    `Full name: ${input.buyerName}`,
    `Email: ${input.buyerEmail}`,
    input.buyerPhone ? `Phone: ${input.buyerPhone}` : "",
    input.inquiryMessage ? `Message: ${input.inquiryMessage}` : "",
    input.requestedQuantity ? `Requested quantity: ${input.requestedQuantity}` : "",
    input.offeredPrice ? `Offered price: ${input.offeredPrice}` : "",
  ].filter((line) => line.trim().length > 0);

  const htmlLines = [
    `<strong>Container:</strong> ${escapeHtml(input.summaryLine)}<br/>`,
    `<strong>Company/listing:</strong> ${escapeHtml(input.companyName)}<br/>`,
    `<strong>Quantity in listing:</strong> ${input.listingQuantity}`,
    "<br/><br/><strong>Buyer details:</strong><br/>",
    `<strong>Full name:</strong> ${escapeHtml(input.buyerName)}<br/>`,
    `<strong>Email:</strong> ${escapeHtml(input.buyerEmail)}<br/>`,
    input.buyerPhone ? `<strong>Phone:</strong> ${escapeHtml(input.buyerPhone)}<br/>` : "",
    input.inquiryMessage
      ? `<strong>Message:</strong><br/>${escapeHtml(input.inquiryMessage).replaceAll("\n", "<br/>")}<br/>`
      : "",
    input.requestedQuantity
      ? `<strong>Requested quantity:</strong> ${input.requestedQuantity}<br/>`
      : "",
    input.offeredPrice
      ? `<strong>Offered price:</strong> ${escapeHtml(input.offeredPrice)}`
      : "",
  ]
    .filter((line) => line.trim().length > 0)
    .join("");

  return {
    subject,
    text: renderTextLayout({ sections }),
    html: renderHtmlLayout({
      preheader: "A new container inquiry has been submitted.",
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
  const subject = `New concierge stock upload - ${input.companyName}`;

  const textSections = [
    "A new concierge bulk upload request has been submitted.",
    `Company: ${input.companyName}`,
    input.companySlug ? `Company slug: ${input.companySlug}` : "",
    `User: ${input.userName} (${input.userEmail})`,
    input.contactEmail ? `Contact email: ${input.contactEmail}` : "",
    input.contactPhone ? `Contact phone: ${input.contactPhone}` : "",
    `File: ${input.fileName}`,
    `File type: ${input.fileContentType}`,
    `File size: ${input.fileSizeBytes} B`,
    `File URL: ${input.fileUrl}`,
    `Submitted at: ${input.requestedAtIso}`,
    input.note ? `Note: ${input.note}` : "",
  ].filter((line) => line.trim().length > 0);

  const htmlLines = [
    "<strong>A new concierge bulk upload request has been submitted</strong><br/>",
    `<strong>Company:</strong> ${escapeHtml(input.companyName)}<br/>`,
    input.companySlug ? `<strong>Company slug:</strong> ${escapeHtml(input.companySlug)}<br/>` : "",
    `<strong>User:</strong> ${escapeHtml(input.userName)} (${escapeHtml(input.userEmail)})<br/>`,
    input.contactEmail ? `<strong>Contact email:</strong> ${escapeHtml(input.contactEmail)}<br/>` : "",
    input.contactPhone ? `<strong>Contact phone:</strong> ${escapeHtml(input.contactPhone)}<br/>` : "",
    `<strong>File:</strong> ${escapeHtml(input.fileName)}<br/>`,
    `<strong>File type:</strong> ${escapeHtml(input.fileContentType)}<br/>`,
    `<strong>File size:</strong> ${input.fileSizeBytes} B<br/>`,
    `<strong>Submitted at:</strong> ${escapeHtml(input.requestedAtIso)}<br/>`,
    `<strong>File URL:</strong> <a href="${escapeHtml(input.fileUrl)}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${escapeHtml(input.fileUrl)}</a><br/>`,
    input.note
      ? `<br/><strong>Note:</strong><br/>${escapeHtml(input.note).replaceAll("\n", "<br/>")}`
      : "",
  ]
    .filter((line) => line.trim().length > 0)
    .join("");

  return {
    subject,
    text: renderTextLayout({ sections: textSections }),
    html: renderHtmlLayout({
      preheader: "A new concierge upload request is ready for review.",
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
    ? expiresAt.toLocaleDateString("en-US")
    : input.expiresAtIso;
  const subject =
    input.reminderDays <= 2
      ? "Final reminder: your listing expires in 2 days"
      : "Reminder: your listing expires in 7 days";

  const textSections = [
    `Your listing for ${input.companyName} expires on ${expiresAtLabel}.`,
    `Current quantity: ${input.quantity}.`,
    "Before renewing, please confirm that the quantity and price are still up to date.",
    `Manage listings: ${input.manageUrl}`,
    `Edit listing: ${input.editUrl}`,
  ];

  const htmlSections =
    htmlParagraphRaw(
      `Your listing for <strong>${escapeHtml(input.companyName)}</strong> expires on <strong>${escapeHtml(expiresAtLabel)}</strong>.`,
    ) +
    htmlParagraphRaw(
      `Current quantity: <strong>${Math.max(1, Math.trunc(input.quantity))}</strong>.`,
    ) +
    htmlParagraph("Before renewing, please confirm that the quantity and price are still up to date.") +
    htmlButton(input.manageUrl, "Manage listings") +
    htmlParagraphRaw(
      `If anything has changed, edit the listing here:<br/><a href="${escapeHtml(input.editUrl)}" style="color:${MAIL_COLORS.link};text-decoration:underline;word-break:break-all;">${escapeHtml(input.editUrl)}</a>`,
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
          ? "Final reminder about your listing expiry."
          : "Reminder about your listing expiry.",
      title: subject,
      intro,
      contentHtml: htmlSections,
    }),
  };
}
