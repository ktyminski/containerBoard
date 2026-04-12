import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppCookieNotice } from "@/components/app-cookie-notice";
import { AppFooterGuard } from "@/components/app-footer-guard";
import { InAppNavigationHistoryTracker } from "@/components/in-app-navigation-history-tracker";
import { AppNavbar } from "@/components/app-navbar";
import { FocusVisibleInit } from "@/components/focus-visible-init";
import { ToastProvider } from "@/components/toast-provider";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { getMessages, LOCALE_COOKIE_NAME, resolveLocale } from "@/lib/i18n";
import { getSiteUrl } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "ContainerBoard",
    template: "%s | ContainerBoard",
  },
  description:
    "Tablica kontenerow: dostepne i poszukiwane kontenery oraz szybkie zapytania email.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    siteName: "ContainerBoard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
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
            <AppFooterGuard locale={locale} messages={messages.footer} />
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
