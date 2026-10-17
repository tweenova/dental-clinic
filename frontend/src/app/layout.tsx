import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PublicContentProvider } from "@/components/providers/public-content-provider";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Marlow Dental | Modern, Ethical Dental Care",
  description:
    "An independent private dental practice. We run on time, explain everything before we start, and provide transparent care.",
  metadataBase: new URL("https://marlowdental.com"),
  manifest: "/manifest.webmanifest",
  keywords: [
    "dental clinic",
    "dental cleanings",
    "preventive dentistry",
    "restorative dentistry",
    "oral healthcare",
  ],
  authors: [{ name: "Marlow Dental Clinical Team" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Marlow Dental | Modern, Ethical Dental Care",
    description:
      "Independent dental practice providing comprehensive preventive and restorative clinical care.",
    url: "https://marlowdental.com",
    siteName: "Marlow Dental",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Marlow Dental | Modern, Ethical Dental Care",
    description:
      "Independent private dental practice delivering unhurried, ethical clinical care.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "DentalClinic",
  name: "Marlow Dental",
  description:
    "An independent private dental practice specializing in preventive and restorative oral care.",
  paymentAccepted: "Cash, Credit Card, Bank Transfer",
};

/**
 * Root layout component that wraps every page of the Marlow Dental website.
 * It configures custom typography fonts, injects structured JSON-LD schema markup for local SEO, and sets up theme support.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('marlow_theme_preference');
                  var isDark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="grain bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <ThemeProvider>
          <AuthProvider>
            <PublicContentProvider>{children}</PublicContentProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}