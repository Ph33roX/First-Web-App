import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stock Side Bets",
  description: "Track friendly stock wagers with real market data"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans", inter.className)}>
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
