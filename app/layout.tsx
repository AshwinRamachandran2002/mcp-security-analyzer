import "./globals.css";

import type { Metadata } from "next";

import { Inter } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import Nav from "@/components/parts/nav";

const font = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentic Tool Red Team Dashboard | Automated Security Analysis",
  description:
    "Automated attack vector detection and threat reporting for Model Context Protocol servers. Built for security researchers and developers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${font.className} flex flex-col-reverse sm:grid sm:overflow-hidden sm:h-screen sm:w-screen sm:grid-cols-[256px,1fr]`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          <Nav />
          <main className="py-4 pr-4 pl-4 sm:pl-0 flex flex-col gap-4 min-h-screen">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
