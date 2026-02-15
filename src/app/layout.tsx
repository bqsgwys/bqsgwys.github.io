import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bqsgwys | Homepage",
  description: "Personal frontend homepage deployed by GitHub Pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
