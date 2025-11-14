import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import Link from "next/link";
import "./globals.css";
import AnalyticsListener from "./ga/AnalyticsListener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adesão – Contrato Seguros",
  description: "Envie os dados de adesão de forma rápida e segura",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || "G-NWHS5JN1ZN";

  return (
    <html lang="pt-BR" style={{ colorScheme: "light" }}>
      <head>
        {/* força tema claro no user agent (inputs nativos, etc.) */}
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#ffffff" />

        {/* Google Analytics 4 */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* GA - escuta mudanças de rota (App Router) */}
        <AnalyticsListener />

        {/* Header */}
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand" aria-label="Início">
              Contrato Seguros
            </Link>
            <nav className="nav">
              <Link href="/" className="nav-link">
                Adesão
              </Link>
              <Link href="/faq" className="nav-link">
                FAQ
              </Link>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="site-main">{children}</main>

        {/* Footer */}
        <footer className="site-footer">
          <div className="container footer-inner">
            <nav className="footer-nav">
              <Link href="/" className="nav-link">
                Adesão
              </Link>
              <Link href="/faq" className="nav-link">
                FAQ
              </Link>
            </nav>
            <small className="copyright">
              © {new Date().getFullYear()} Contrato Seguros
            </small>
          </div>
        </footer>
      </body>
    </html>
  );
}
