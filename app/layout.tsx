import type { Metadata } from "next";
import { Theme } from "@radix-ui/themes";
import { Outfit } from "next/font/google";
import "@radix-ui/themes/styles.css";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

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
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
        <Theme
          appearance="dark"
          accentColor="indigo"
          grayColor="slate"
          radius="large"
          scaling="95%"
        >
          {children}
        </Theme>
      </body>
    </html>
  );
}
