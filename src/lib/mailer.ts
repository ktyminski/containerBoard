import { getEnv } from "@/lib/env";
import {
  buildConciergeStockUploadMail,
  buildContainerInquiryMail,
  buildClaimDecisionMail,
  buildClaimSubmittedMail,
  buildEmailVerificationMail,
  buildListingExpiryReminderMail,
  buildOfferPublishedMail,
  buildPasswordResetMail,
  buildWelcomeMail,
} from "@/lib/mail-templates";

export type SendMailResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export type SendMailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

type SendMailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  attachments?: SendMailAttachment[];
};

const DEFAULT_PROD_MAIL_FROM = "no-reply@containerboard.pl";
const DEFAULT_PROD_MAIL_REPLY_TO = "support@containerboard.pl";
const DEFAULT_DEV_MAIL_FROM = "onboarding@resend.dev";
const DEFAULT_DEV_MAIL_REPLY_TO = "onboarding@resend.dev";

export async function sendMail(payload: SendMailPayload): Promise<SendMailResult> {
  try {
    const env = getEnv();
    if (!env.RESEND_API_KEY) {
      return {
        ok: false,
        error: "RESEND_API_KEY is not configured",
      };
    }

    const isProduction = env.NODE_ENV === "production";
    const mailFrom =
      env.MAIL_FROM?.trim() ||
      (isProduction ? DEFAULT_PROD_MAIL_FROM : DEFAULT_DEV_MAIL_FROM);
    const mailReplyTo =
      env.MAIL_REPLY_TO?.trim() ||
      (isProduction ? DEFAULT_PROD_MAIL_REPLY_TO : DEFAULT_DEV_MAIL_REPLY_TO);

    const recipients = Array.from(
      new Set(
        (Array.isArray(payload.to) ? payload.to : [payload.to])
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    );
    if (recipients.length === 0) {
      return {
        ok: false,
        error: "No recipients",
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom,
        to: recipients,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        reply_to: mailReplyTo,
        attachments: payload.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          content_type: attachment.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      return {
        ok: false,
        status: response.status,
        error: responseText || "Unknown mail provider error",
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown sendMail error",
    };
  }
}

export async function sendWelcomeEmail(input: {
  to: string;
  name?: string;
}): Promise<SendMailResult> {
  const template = buildWelcomeMail(input.name);
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  name?: string;
  verificationUrl: string;
}): Promise<SendMailResult> {
  const template = buildEmailVerificationMail({
    name: input.name,
    verificationUrl: input.verificationUrl,
  });
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string;
  resetUrl: string;
}): Promise<SendMailResult> {
  const template = buildPasswordResetMail({
    name: input.name,
    resetUrl: input.resetUrl,
  });
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendClaimSubmittedEmail(input: {
  to: string;
  companyName: string;
  name?: string;
}): Promise<SendMailResult> {
  const template = buildClaimSubmittedMail(input.companyName, input.name);
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendClaimApprovedEmail(input: {
  to: string;
  companyName: string;
  name?: string;
}): Promise<SendMailResult> {
  const template = buildClaimDecisionMail({
    approved: true,
    companyName: input.companyName,
    name: input.name,
  });
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendClaimRejectedEmail(input: {
  to: string;
  companyName: string;
  name?: string;
}): Promise<SendMailResult> {
  const template = buildClaimDecisionMail({
    approved: false,
    companyName: input.companyName,
    name: input.name,
  });
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendOfferPublishedEmail(input: {
  to: string;
  name?: string;
  offerTitle: string;
  companyName: string;
  offerUrl?: string;
}): Promise<SendMailResult> {
  const template = buildOfferPublishedMail({
    name: input.name,
    offerTitle: input.offerTitle,
    companyName: input.companyName,
    offerUrl: input.offerUrl,
  });
  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendContainerInquiryEmail(input: {
  to: string;
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
}): Promise<SendMailResult> {
  const template = buildContainerInquiryMail({
    containerLabel: input.containerLabel,
    summaryLine: input.summaryLine,
    companyName: input.companyName,
    listingQuantity: input.listingQuantity,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    buyerPhone: input.buyerPhone,
    inquiryMessage: input.inquiryMessage,
    requestedQuantity: input.requestedQuantity,
    offeredPrice: input.offeredPrice,
  });

  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendConciergeStockUploadNotificationEmail(input: {
  to: string;
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
}): Promise<SendMailResult> {
  const template = buildConciergeStockUploadMail({
    companyName: input.companyName,
    companySlug: input.companySlug,
    userName: input.userName,
    userEmail: input.userEmail,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    fileContentType: input.fileContentType,
    fileUrl: input.fileUrl,
    note: input.note,
    requestedAtIso: input.requestedAtIso,
  });

  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export async function sendListingExpiryReminderEmail(input: {
  to: string;
  name?: string;
  companyName: string;
  quantity: number;
  expiresAtIso: string;
  reminderDays: number;
  manageUrl: string;
  editUrl: string;
}): Promise<SendMailResult> {
  const template = buildListingExpiryReminderMail({
    name: input.name,
    companyName: input.companyName,
    quantity: input.quantity,
    expiresAtIso: input.expiresAtIso,
    reminderDays: input.reminderDays,
    manageUrl: input.manageUrl,
    editUrl: input.editUrl,
  });

  return sendMail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
