import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://qr.playzones.app'),
  title: "QR Playzones - מערכת קודי QR דינמיים",
  description: "צור קודי QR דינמיים עם תצוגת מדיה מתקדמת",
  icons: {
    icon: "/favicon.svg",
    apple: "/QLogo.jpg",
  },
  openGraph: {
    title: "QR Playzones - תוכן QR דינמי",
    description: "צור קודי QR דינמיים עם תצוגת מדיה מתקדמת",
    images: [
      {
        url: "/QLogo.jpg",
        width: 512,
        height: 512,
        alt: "QR Playzones Logo",
      },
    ],
    siteName: "QR Playzones",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "QR Playzones - תוכן QR דינמי",
    description: "צור קודי QR דינמיים עם תצוגת מדיה מתקדמת",
    images: ["/QLogo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
