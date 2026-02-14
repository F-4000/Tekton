import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tekton",
  description:
    "Trustless on-chain OTC trading desk on Bitcoin via MIDL Protocol. Trade BTC and Rune tokens peer-to-peer with escrow protection.",
  icons: {
    icon: "/logo-square.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased bg-[#fafafa] text-[#0a0a0a] min-h-screen grid-pattern`}
      >
        <Providers>
          <Navbar />
          <main className="relative z-10">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
