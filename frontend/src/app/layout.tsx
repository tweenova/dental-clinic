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
  title: "Marlow Dental, Lincoln Park Chicago | Dentistry without the dread",
  description:
    "A small, independent dental practice in Lincoln Park, Chicago. We run on time, explain everything before we start, and never upsell you on treatment you do not need.",
  metadataBase: new URL("https://marlowdental.com"),
  manifest: "/manifest.webmanifest",
  keywords: [
    "Lincoln Park dentist",
    "Chicago dental clinic",
    "Dr. Sarah Marlow",
    "honest dentist Chicago",
    "dental cleanings Lincoln Park",
    "emergency dentist Chicago 60614",
    "dental crowns Lincoln Park",
  ],
  authors: [{ name: "Dr. Sarah Marlow, DDS" }],
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
    title: "Marlow Dental | Dentistry without the dread",
    description:
      "Independent dental practice in Lincoln Park. Same-week openings. Written estimates before treatment. One dentist, start to finish.",
    url: "https://marlowdental.com",
    siteName: "Marlow Dental",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Marlow Dental | Dentistry without the dread",
    description:
      "Independent dental practice in Lincoln Park, Chicago. Dr. Sarah Marlow, DDS.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "DentalClinic",
  name: "Marlow Dental",
  description:
    "An independent private dental practice in Lincoln Park, Chicago specializing in unhurried preventive, restorative, and emergency care.",
  url: "https://marlowdental.com",
  telephone: "+1-312-555-0147",
  email: "hello@marlowdental.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "214 Alder Street, Suite 3",
    addressLocality: "Chicago",
    addressRegion: "IL",
    postalCode: "60614",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 41.918,
    longitude: -87.649,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "08:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Friday",
      opens: "08:00",
      closes: "14:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "09:00",
      closes: "13:00",
    },
  ],
  priceRange: "$$",
  currenciesAccepted: "USD",
  paymentAccepted: "Cash, Credit Card, CareCredit, Dental PPO Insurance",
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