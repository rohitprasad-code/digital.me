import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Me - Rohit Prasad",
  description: "Interactive Digital Twin AI Portfolio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
