import { z } from "zod";
import { searchGeocode } from "@/lib/geocode-search";
import type { AppLocale } from "@/lib/i18n";
import {
  LEAD_REQUEST_TRANSPORT_MODES,
  LEAD_REQUEST_TYPES,
} from "@/lib/lead-request-types";

export const leadRequestInputSchema = z
  .object({
    leadType: z.enum(LEAD_REQUEST_TYPES),
    description: z.string().trim().min(20).max(10_000),
    originLocation: z.string().trim().max(220).optional().default(""),
    destinationLocation: z.string().trim().max(220).optional().default(""),
    originCountryCode: z
      .union([z.string().trim().regex(/^[A-Za-z]{2}$/), z.literal("")])
      .optional()
      .default(""),
    destinationCountryCode: z
      .union([z.string().trim().regex(/^[A-Za-z]{2}$/), z.literal("")])
      .optional()
      .default(""),
    transportMode: z
      .enum(LEAD_REQUEST_TRANSPORT_MODES)
      .optional()
      .default("any"),
    contactEmail: z
      .union([z.string().trim().email().max(220), z.literal("")])
      .optional()
      .default(""),
    contactPhone: z
      .union([z.string().trim().min(3).max(60), z.literal("")])
      .optional()
      .default(""),
  })
  .superRefine((value, context) => {
    if (!value.contactEmail.trim() && !value.contactPhone.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one contact field is required",
        path: ["contactEmail"],
      });
    }
    if (value.leadType === "transport") {
      if (value.originLocation.trim().length < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Origin is required",
          path: ["originLocation"],
        });
      }
      if (value.destinationLocation.trim().length < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination is required",
          path: ["destinationLocation"],
        });
      }
    }
  });

export function normalizeLeadRequestDescription(input: string): string {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export function normalizeLeadRequestLocation(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export async function resolveLeadRequestTransportLocation(input: {
  location: string;
  locale: AppLocale;
}) {
  const [item] = await searchGeocode({
    query: input.location,
    lang: input.locale,
    limit: 1,
  });

  if (!item?.countryCode) {
    return null;
  }

  return {
    countryCode: item.countryCode,
    locationLabel: item.shortLabel || item.label,
  };
}
