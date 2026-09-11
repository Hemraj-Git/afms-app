import type { Metadata } from "next";
import "./globals.css";
import { AFMSProvider } from "@/context/AFMSContext";
import { Providers } from "@/providers/QueryProvider";

export const metadata: Metadata = {
  title: "AFMS - Asset & Facility Management System | Hemraj Marines Services",
  description: "Quality compliance-ready digital asset & facility management system for Maritime Training Institutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        <Providers>
          <AFMSProvider>
            {children}
          </AFMSProvider>
        </Providers>
      </body>
    </html>
  );
}
