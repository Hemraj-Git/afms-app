import type { Metadata } from "next";
import "./globals.css";
import { AFMSProvider } from "@/context/AFMSContext";
import { Toaster } from "@/components/ui/Toaster";
import { ConfirmHost } from "@/components/ui/ConfirmHost";
import { QueryProvider } from "@/components/QueryProvider";
import { CLIENT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: CLIENT_NAME ? `AssetNXG | ${CLIENT_NAME}` : "AssetNXG - Asset & Facility Management",
  description: "AssetNXG (Asset Next Generation): cloud-based asset & facility management that keeps the organisation compliance-ready.",
  // iPhone "Add to Home Screen" uses these (the manifest covers other phones).
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "AssetNXG", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        <QueryProvider>
          <AFMSProvider>
            {children}
          </AFMSProvider>
        </QueryProvider>
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}
