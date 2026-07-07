import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast"; // Import do Toaster global
import { NetworkMonitor } from "@/app/components/NetworkMonitor"; // Import do nosso monitor
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
  description: "Gestão de Obras e Calculadora de Materiais",
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
      lang="pt-BR" // Alterado para pt-BR para correta acessibilidade e leitores de tela
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* O monitor não tem visual, ele só roda a lógica de conexão em background */}
        <NetworkMonitor />
        
        {/* O Toaster global garante que os alertas funcionem em qualquer tela */}
        <Toaster position="top-center" />
        
        {children}
      </body>
    </html>
  );
}