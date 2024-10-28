import { MySessionProvider } from "@/components/seesion-provider";
import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from "next";
import { Fira_Code } from 'next/font/google';
import "./globals.css";

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
})

export const metadata: Metadata = {
  title: "🐟",
  description: "A photo album of our travels",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`antialiased ${firaCode.className}`}>
        <MySessionProvider>
          {children}
          <Toaster />
        </MySessionProvider>
      </body>
    </html>
  );
}
