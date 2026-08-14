import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NotesVault | Secure Expiring Share Links",
  description: "Create and share secure self-destructing notes with one-time or time-based access keys.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground`}>
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
          {children}
        </main>
      </body>
    </html>
  );
}
