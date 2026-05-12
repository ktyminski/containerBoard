import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppCookieNotice } from "@/components/app-cookie-notice";
import { AppFooter } from "@/components/app-footer";
import { InAppNavigationHistoryTracker } from "@/components/in-app-navigation-history-tracker";
import { AppNavbar } from "@/components/app-navbar";
import { FocusVisibleInit } from "@/components/focus-visible-init";
import { ToastProvider } from "@/components/toast-provider";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getMessages, LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";
import {
  DEFAULT_OPEN_GRAPH_IMAGE_PATH,
  getAbsoluteUrl,
  getSiteUrl,
  SITE_NAME,
} from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultOpenGraphImage = getAbsoluteUrl(DEFAULT_OPEN_GRAPH_IMAGE_PATH);

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: defaultOpenGraphImage,
        width: 1200,
        height: 900,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultOpenGraphImage],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const messages = getMessages(locale);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FocusVisibleInit />
        <ToastProvider messages={messages.common}>
          <div className="flex min-h-screen flex-col bg-neutral-200 text-neutral-900">
            <InAppNavigationHistoryTracker />
            <AppNavbar locale={locale} messages={messages} />
            <div className="w-full flex-1">{children}</div>
            <AppFooter locale={locale} messages={messages.footer} />
            <AppCookieNotice
              locale={locale}
              messages={messages.cookieNotice}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
