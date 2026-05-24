import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import {
  getLocaleFromRequest,
  LOCALE_COOKIE_NAME,
  withLocalePrefix,
  type AppLocale,
} from "@/lib/i18n";
import { renewListingWithToken } from "@/lib/listing-renewal-tokens";

export const dynamic = "force-dynamic";

type RenewListingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type RenewListingMessages = {
  metaTitle: string;
  brandLabel: string;
  renewedTitle: string;
  alreadyRenewedTitle: string;
  invalidTitle: string;
  successMessage: (date: string) => string;
  closedMessage: string;
  invalidMessage: string;
  openListing: string;
  manageListings: string;
};

const RENEW_LISTING_MESSAGES: Record<AppLocale, RenewListingMessages> = {
  pl: {
    metaTitle: "Przedłużenie oferty | ContainerBoard",
    brandLabel: "ContainerBoard",
    renewedTitle: "Oferta została przedłużona",
    alreadyRenewedTitle: "Oferta była już przedłużona",
    invalidTitle: "Link do przedłużenia nie jest już ważny",
    successMessage: (date) => `Oferta jest aktywna do ${date}.`,
    closedMessage: "Ta oferta została zamknięta, więc nie można jej przedłużyć tym linkiem.",
    invalidMessage:
      "Link do przedłużenia jest nieprawidłowy albo wygasł. Otwórz swoje oferty i przedłuż ogłoszenie ręcznie.",
    openListing: "Otwórz ofertę",
    manageListings: "Zarządzaj ofertami",
  },
  en: {
    metaTitle: "Renew listing | ContainerBoard",
    brandLabel: "ContainerBoard",
    renewedTitle: "Listing renewed",
    alreadyRenewedTitle: "Listing already renewed",
    invalidTitle: "Renewal link is no longer valid",
    successMessage: (date) => `This listing is active until ${date}.`,
    closedMessage: "This listing has been closed, so it cannot be renewed with this link.",
    invalidMessage:
      "The renewal link is invalid or expired. Please open your listings and renew the offer manually.",
    openListing: "Open listing",
    manageListings: "Manage listings",
  },
  de: {
    metaTitle: "Inserat verlängern | ContainerBoard",
    brandLabel: "ContainerBoard",
    renewedTitle: "Inserat wurde verlängert",
    alreadyRenewedTitle: "Inserat wurde bereits verlängert",
    invalidTitle: "Der Verlängerungslink ist nicht mehr gültig",
    successMessage: (date) => `Dieses Inserat ist bis ${date} aktiv.`,
    closedMessage:
      "Dieses Inserat wurde geschlossen und kann über diesen Link nicht verlängert werden.",
    invalidMessage:
      "Der Verlängerungslink ist ungültig oder abgelaufen. Öffnen Sie Ihre Inserate und verlängern Sie das Angebot manuell.",
    openListing: "Inserat öffnen",
    manageListings: "Inserate verwalten",
  },
  uk: {
    metaTitle: "Prodovzhennia oholoshennia | ContainerBoard",
    brandLabel: "ContainerBoard",
    renewedTitle: "Oholoshennia prodovzheno",
    alreadyRenewedTitle: "Oholoshennia vzhe prodovzheno",
    invalidTitle: "Posylannia dlia prodovzhennia bilshe ne diisne",
    successMessage: (date) => `Oholoshennia aktyvne do ${date}.`,
    closedMessage:
      "Tse oholoshennia zakryte, tomu yoho ne mozhna prodovzhyty za tsym posylanniam.",
    invalidMessage:
      "Posylannia dlia prodovzhennia nedijsne abo zastrile. Vidkryite svoi oholoshennia i prodovzhit propozytsiiu vruchnu.",
    openListing: "Vidkryty oholoshennia",
    manageListings: "Keruvaty oholoshenniamy",
  },
};

function getToken(params: Record<string, string | string[] | undefined>): string {
  const value = params.token;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: Date, locale: AppLocale): string {
  return value.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function resolveRenewPageLocale(
  params: Record<string, string | string[] | undefined>,
): Promise<AppLocale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return getLocaleFromRequest({
    params,
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerLocale: headerStore.get("x-containerboard-locale"),
    acceptLanguage: headerStore.get("accept-language"),
  });
}

export async function generateMetadata({
  searchParams,
}: RenewListingPageProps): Promise<Metadata> {
  const params = await searchParams;
  const locale = await resolveRenewPageLocale(params);

  return {
    title: RENEW_LISTING_MESSAGES[locale].metaTitle,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function RenewListingPage({
  searchParams,
}: RenewListingPageProps) {
  const params = await searchParams;
  const locale = await resolveRenewPageLocale(params);
  const messages = RENEW_LISTING_MESSAGES[locale];
  const result = await renewListingWithToken(getToken(params));
  const isSuccess = result.ok;
  const title = isSuccess
    ? result.status === "already-renewed"
      ? messages.alreadyRenewedTitle
      : messages.renewedTitle
    : messages.invalidTitle;
  const message = isSuccess
    ? messages.successMessage(formatDate(result.expiresAt, locale))
    : result.status === "listing-closed"
      ? messages.closedMessage
      : messages.invalidMessage;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-neutral-100 px-4 py-12 text-neutral-900">
      <div className="mx-auto max-w-xl rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
          {messages.brandLabel}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-neutral-600">{message}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {isSuccess ? (
            <Link
              href={withLocalePrefix(`/containers/${result.listingId}`, locale)}
              className="inline-flex items-center justify-center rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              {messages.openListing}
            </Link>
          ) : null}
          <Link
            href={`/containers/mine?lang=${locale}`}
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            {messages.manageListings}
          </Link>
        </div>
      </div>
    </main>
  );
}
