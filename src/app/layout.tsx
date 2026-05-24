import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Link from 'next/link';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Allo Inventory System",
  description: "Real-time inventory reservation system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <header className="mb-8 border-b pb-4 flex justify-between items-center">
              <div>
                <Link href="/" className="hover:opacity-80 transition-opacity">
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Allo Inventory</h1>
                </Link>
                <p className="text-gray-500">Real-time stock reservation & fulfillment</p>
              </div>
              <nav>
                <Link href="/ops" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-2 rounded-md border border-blue-100">
                  Operations Dashboard
                </Link>
              </nav>
            </header>
            {children}
          </div>
        </main>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
