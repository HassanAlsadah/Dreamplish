import type { Metadata, Viewport } from "next";
import { Alexandria, Amiri, Bricolage_Grotesque, IBM_Plex_Sans_Arabic } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { getDir } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/* Headings: Bricolage Grotesque for English, Alexandria for Arabic (picked by page language in
   globals.css). Variable fonts, self-hosted by next/font, swapped in without layout shift. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const alexandria = Alexandria({
  variable: "--font-alexandria",
  subsets: ["arabic", "latin"],
  display: "swap",
});

/* Wordmark only (the kashida logo from the reference design). */
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return {
    // Makes the social image and other metadata URLs absolute.
    metadataBase: new URL(SITE_URL),
    title: { default: `${d.brand.name} — ${d.brand.tagline}`, template: `%s · ${d.brand.name}` },
    description: d.meta.description,
    // Google Search Console ownership check (needed for Google's brand verification of the sign-in screen).
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    // Matches the top bar (--topbar): white in light mode, black in dark mode.
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getI18n();
  // The proxy's per-request nonce, for the theme script (the CSP blocks scripts without it).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang={locale}
      dir={getDir(locale)}
      suppressHydrationWarning
      className={`${plex.variable} ${bricolage.variable} ${alexandria.variable} ${amiri.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers locale={locale} nonce={nonce}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
