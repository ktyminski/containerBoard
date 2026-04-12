import maplibregl from "maplibre-gl";
import { COMPANY_VERIFICATION_STATUS } from "@/lib/company-verification";
import { withLang, type AppLocale, type AppMessages } from "@/lib/i18n";
import type { CompanyMapItem } from "@/types/company";
import type { OfferMapItem } from "@/components/unified-main-map/types";
import {
  escapeHtml,
  formatCompanySummary,
  getCompanyFallbackColor,
  getCompanyInitial,
  getOfferTypeLabel,
} from "@/components/unified-main-map/utils";

function offerPopupCard(
  offer: OfferMapItem,
  messages: AppMessages["mapModules"]["offers"],
  locale: AppLocale,
): string {
  const typeLabel = getOfferTypeLabel(offer.offerType, messages);
  const fallbackColor = getCompanyFallbackColor(offer.companySlug || offer.companyName);
  const detailsUrl = withLang(`/offers/${offer.id}`, locale);
  const logo = offer.companyLogoUrl
    ? `<img src="${escapeHtml(offer.companyLogoUrl)}" alt="${escapeHtml(offer.companyName)}" style="width:100%;height:100%;object-fit:contain;" />`
    : `<div style="display:flex;height:100%;width:100%;align-items:center;justify-content:center;background:${fallbackColor};font-size:13px;font-weight:700;color:#fff;">${escapeHtml(getCompanyInitial(offer.companyName))}</div>`;
  const popupItemClass = offer.companyIsPremium
    ? "company-map-popup-item company-map-popup-item--premium"
    : "company-map-popup-item";
  const popupCardClass = offer.companyIsPremium
    ? "company-map-popup-card company-map-popup-card--premium"
    : "company-map-popup-card";

  return `<a href="${detailsUrl}" class="${popupItemClass}">
    <div class="${popupCardClass}" style="padding:6px 8px;">
      <div class="company-map-popup-card__row">
        <div class="company-map-popup-card__logo">${logo}</div>
        <div class="company-map-popup-card__content" style="line-height:1.15;">
          <div style="font-size:13px; font-weight:600; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(offer.title)}</div>
          <div style="margin-top:0; font-size:12px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(typeLabel)}</div>
          <div style="margin-top:0; font-size:12px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(offer.companyName)}</div>
        </div>
      </div>
    </div>
  </a>`;
}

function companyPopupCard(
  company: CompanyMapItem,
  messages: AppMessages["map"],
  verifiedLabel: AppMessages["companyStatus"]["verified"],
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
  locale: AppLocale,
): string {
  const summary = escapeHtml(formatCompanySummary(company, messages, operatingAreaLabels, specializationLabels));
  const detailsUrl = withLang(`/companies/${company.slug}`, locale);
  const fallbackColor = getCompanyFallbackColor(company.id);
  const premiumLogoStyle = company.isPremium
    ? "box-shadow:0 0 12px rgba(52,211,153,0.3);"
    : "";
  const popupItemClass = company.isPremium
    ? "company-map-popup-item company-map-popup-item--premium"
    : "company-map-popup-item";
  const popupCardClass = company.isPremium
    ? "company-map-popup-card company-map-popup-card--premium"
    : "company-map-popup-card";
  const nameStyle = company.isPremium ? ' style="color:#d1fae5;"' : "";
  const summaryStyle = company.isPremium ? ' style="color:rgba(110,231,183,0.86);"' : "";
  const logo = company.logoUrl
    ? `<img src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.name)}" style="width:100%;height:100%;object-fit:contain;" />`
    : `<div style="display:flex;height:100%;width:100%;align-items:center;justify-content:center;background:${fallbackColor};font-size:13px;font-weight:700;color:#fff;">${escapeHtml(getCompanyInitial(company.name))}</div>`;
  const verifiedBadge =
    company.verificationStatus === COMPANY_VERIFICATION_STATUS.VERIFIED
      ? `<svg viewBox="0 0 20 20" fill="none" class="company-map-popup-card__verified-icon" aria-hidden="true" aria-label="${escapeHtml(verifiedLabel)}" title="${escapeHtml(verifiedLabel)}"><path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>`
      : "";

  return `<a href="${detailsUrl}" class="${popupItemClass}">
    <div class="${popupCardClass}">
      <div class="company-map-popup-card__row">
      <div class="company-map-popup-card__logo"${premiumLogoStyle ? ` style="${premiumLogoStyle}"` : ""}>${logo}</div>
      <div class="company-map-popup-card__content">
        <div class="company-map-popup-card__name-row">
          <span class="company-map-popup-card__name-inline">
            <span class="company-map-popup-card__name"${nameStyle}>${escapeHtml(company.name)}</span>
            ${verifiedBadge}
          </span>
        </div>
        <div class="company-map-popup-card__summary"${summaryStyle}>${summary}</div>
      </div>
    </div>
    </div>
  </a>`;
}

function wrapPopupBody(body: string, width: "normal" | "wide" = "normal"): string {
  if (width === "wide") {
    return `<div style="font-family: sans-serif; min-width:280px; max-width:448px; background:#0f172a; color:#e2e8f0; border-radius:10px; overflow:hidden;"><div class="company-map-popup-scroll" style="max-height:220px; overflow-y:auto;"><div class="company-map-popup-list" style="padding:8px 10px 8px 8px;">${body}</div></div></div>`;
  }

  return `<div style="font-family: sans-serif; min-width:260px; max-width:380px; background:#0f172a; color:#e2e8f0; border-radius:10px; overflow:hidden;"><div class="company-map-popup-scroll" style="max-height:220px; overflow-y:auto;"><div class="company-map-popup-list" style="padding:4px 6px 4px 4px;">${body}</div></div></div>`;
}

function createPopup(
  map: maplibregl.Map,
  lngLat: [number, number],
  body: string,
  width: "normal" | "wide" = "normal",
): maplibregl.Popup {
  return new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    className: "company-map-popup",
  })
    .setLngLat(lngLat)
    .setHTML(wrapPopupBody(body, width))
    .addTo(map);
}

export function openOffersPopup(
  map: maplibregl.Map,
  offers: OfferMapItem[],
  messages: AppMessages["mapModules"]["offers"],
  locale: AppLocale,
  lngLat: [number, number],
): maplibregl.Popup {
  const body = offers.map((item) => offerPopupCard(item, messages, locale)).join("");
  return createPopup(map, lngLat, body);
}

export function openCompaniesPopup(
  map: maplibregl.Map,
  companies: CompanyMapItem[],
  messages: AppMessages["map"],
  verifiedLabel: AppMessages["companyStatus"]["verified"],
  operatingAreaLabels: AppMessages["mapModules"]["filters"]["operatingAreas"],
  specializationLabels: AppMessages["companyCreate"]["specializationsOptions"],
  locale: AppLocale,
  lngLat: [number, number],
): maplibregl.Popup {
  const prioritizedCompanies = [...companies].sort(
    (left, right) => Number(right.isPremium) - Number(left.isPremium),
  );

  const body = prioritizedCompanies
    .map((company) =>
      companyPopupCard(
        company,
        messages,
        verifiedLabel,
        operatingAreaLabels,
        specializationLabels,
        locale,
      ),
    )
    .join("");

  return createPopup(map, lngLat, body, "wide");
}
