import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE = "https://app.machinest.in";
const GA_ID = "G-56JXGH9WX7";
const DESCRIPTION =
  "Generate CNC turning and milling G-code cycles in minutes and see every machine live on one screen. Built by a working machine shop for Indian job shops.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Machinest Studio | CNC G-code Cycle Generator & Machine Status",
    template: "%s | Machinest Studio",
  },
  description: DESCRIPTION,
  applicationName: "Machinest Studio",
  keywords: [
    "CNC G-code generator",
    "CNC turning cycles",
    "CNC milling cycles",
    "machine status board",
    "machine utilization report",
    "CNC programming tool India",
  ],
  openGraph: {
    type: "website",
    siteName: "Machinest Studio",
    title: "Machinest Studio | CNC G-code Cycle Generator & Machine Status",
    description: DESCRIPTION,
    url: SITE,
    locale: "en_IN",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Machinest Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Machinest Studio | CNC G-code Cycle Generator & Machine Status",
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.png",
  },
};

// Tells Google what Machinest Studio is and who publishes it
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Machinest-India",
      url: SITE,
      logo: `${SITE}/favicon.png`,
      email: "machinestindia@gmail.com",
      address: { "@type": "PostalAddress", addressLocality: "Ahmedabad", addressRegion: "Gujarat", addressCountry: "IN" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Machinest Studio",
      url: SITE,
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {process.env.NODE_ENV === "production" && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
