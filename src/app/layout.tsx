import type { Metadata } from "next";
import { Geist, Geist_Mono, Assistant } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://qr.playzones.app'),
  title: "The Q - Dynamic QR Codes",
  description: "Create dynamic QR codes with advanced media display",
  icons: {
    icon: "/favicon.svg",
    apple: "/theQ.png",
  },
  openGraph: {
    title: "The Q - Dynamic QR Codes",
    description: "Create dynamic QR codes with advanced media display",
    images: [
      {
        url: "/theQ.png",
        width: 512,
        height: 512,
        alt: "The Q Logo",
      },
    ],
    siteName: "The Q",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "The Q - Dynamic QR Codes",
    description: "Create dynamic QR codes with advanced media display",
    images: ["/theQ.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
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
        className={`${geistSans.variable} ${geistMono.variable} ${assistant.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
