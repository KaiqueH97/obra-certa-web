import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast"; // Import do Toaster global
import { NetworkMonitor } from "@/app/components/NetworkMonitor"; // Import do nosso monitor
import { AuthActionsProvider } from "@/app/components/AuthActionsProvider";
import { DocumentLocale } from "@/app/components/DocumentLocale";
import { DEFAULT_LOCALE, translate } from "@/lib/i18n";
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
  title: "Obra Certa",
  description: translate(DEFAULT_LOCALE, "appDescription"),
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* O monitor não tem visual, ele só roda a lógica de conexão em background */}
        <DocumentLocale />
        <NetworkMonitor />
        
        {/* Avisos antigos em texto simples permanecem pt-BR; traduções declaram seu próprio lang. */}
        <div lang="pt-BR"><Toaster position="top-center" /></div>
        
        <AuthActionsProvider>{children}</AuthActionsProvider>
      </body>
    </html>
  );
}
