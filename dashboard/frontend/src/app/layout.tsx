import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Skills — Operations & Control Dashboard",
  description: "Enterprise control dashboard for LinkedIn skills automation toolkit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
